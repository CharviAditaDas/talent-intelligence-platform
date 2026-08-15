-- =====================================================================
-- 0001_schema.sql
-- AI Resume Screening & Talent Intelligence Platform
-- Core relational schema. Run this first.
-- =====================================================================

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- ---------------------------------------------------------------------
-- Enumerated domains
-- ---------------------------------------------------------------------
create type user_role          as enum ('candidate', 'recruiter', 'admin');
create type job_status         as enum ('draft', 'active', 'closed');
create type importance_level   as enum ('required', 'preferred', 'nice_to_have');
create type requirement_kind   as enum ('skill', 'experience', 'education', 'certification', 'responsibility', 'other');
create type evidence_state     as enum ('demonstrated', 'insufficient', 'not_demonstrated');
create type resume_status      as enum ('uploaded', 'queued', 'processing', 'analyzed', 'failed', 'requires_review');
create type application_stage  as enum (
  'submitted', 'ai_screening', 'under_review', 'shortlisted',
  'interview_1', 'interview_2', 'final_evaluation', 'offer', 'hired', 'rejected'
);
create type screening_status   as enum ('queued', 'processing', 'completed', 'partial', 'failed');
create type match_category     as enum ('strong', 'good', 'potential', 'low');
create type ai_job_kind        as enum (
  'resume_parse', 'resume_analysis', 'job_analysis', 'application_screening',
  'interview_kit', 'interview_prep', 'practice_feedback', 'comparison', 'rewrite'
);
create type ai_job_status      as enum ('queued', 'processing', 'completed', 'failed', 'rate_limited', 'cancelled');

-- ---------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        user_role   not null default 'candidate',
  email       text        not null,
  full_name   text        not null default '',
  is_active   boolean     not null default true,
  last_seen_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint profiles_email_lower check (email = lower(email))
);
create index profiles_role_idx on profiles(role) where is_active;

-- ---------------------------------------------------------------------
-- Candidate professional profile  (§14)
-- ---------------------------------------------------------------------
create table candidate_profiles (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null unique references profiles(id) on delete cascade,
  phone             text,
  location          text,
  headline          text,
  summary           text,
  linkedin_url      text,
  portfolio_url     text,
  years_experience  numeric(4,1) check (years_experience >= 0 and years_experience <= 60),
  completeness      smallint not null default 0 check (completeness between 0 and 100),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table candidate_experience (
  id           uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidate_profiles(id) on delete cascade,
  company      text not null,
  title        text not null,
  location     text,
  start_date   date,
  end_date     date,
  is_current   boolean not null default false,
  description  text,
  sort_order   smallint not null default 0,
  constraint experience_date_order check (end_date is null or start_date is null or end_date >= start_date)
);
create index candidate_experience_cid_idx on candidate_experience(candidate_id);

create table candidate_education (
  id           uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidate_profiles(id) on delete cascade,
  institution  text not null,
  degree       text,
  field        text,
  start_year   smallint,
  end_year     smallint,
  grade        text,
  sort_order   smallint not null default 0
);
create index candidate_education_cid_idx on candidate_education(candidate_id);

create table candidate_projects (
  id           uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidate_profiles(id) on delete cascade,
  name         text not null,
  description  text,
  tech_stack   text[] not null default '{}',
  url          text,
  sort_order   smallint not null default 0
);
create index candidate_projects_cid_idx on candidate_projects(candidate_id);

create table candidate_certifications (
  id           uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidate_profiles(id) on delete cascade,
  name         text not null,
  issuer       text,
  issued_on    date,
  expires_on   date,
  credential_id text
);
create index candidate_certifications_cid_idx on candidate_certifications(candidate_id);

-- Canonical skill vocabulary, shared by jobs and candidates
create table skills (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  label       text not null,
  category    text not null default 'technical'
);
create index skills_label_trgm_idx on skills using gin (label gin_trgm_ops);

create table candidate_skills (
  candidate_id uuid not null references candidate_profiles(id) on delete cascade,
  skill_id     uuid not null references skills(id) on delete cascade,
  proficiency  smallint check (proficiency between 1 and 5),
  source       text not null default 'resume',
  primary key (candidate_id, skill_id)
);

-- ---------------------------------------------------------------------
-- Jobs  (§23)
-- ---------------------------------------------------------------------
create table jobs (
  id                uuid primary key default gen_random_uuid(),
  recruiter_id      uuid not null references profiles(id) on delete restrict,
  title             text not null,
  company           text not null,
  location          text not null,
  employment_type   text not null default 'full_time',
  description       text not null default '',
  responsibilities  text[] not null default '{}',
  preferred_quals   text[] not null default '{}',
  nice_to_have      text[] not null default '{}',
  experience_min    numeric(4,1),
  experience_max    numeric(4,1),
  education_level   text,
  status            job_status not null default 'draft',
  spec_version      integer not null default 1,
  published_at      timestamptz,
  closed_at         timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint jobs_experience_range check (
    experience_max is null or experience_min is null or experience_max >= experience_min
  )
);
create index jobs_recruiter_idx on jobs(recruiter_id);
create index jobs_public_idx on jobs(status, published_at desc) where status = 'active';
create index jobs_title_trgm_idx on jobs using gin (title gin_trgm_ops);

create table job_requirements (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references jobs(id) on delete cascade,
  label       text not null,
  kind        requirement_kind not null default 'skill',
  importance  importance_level not null default 'required',
  detail      text,
  skill_id    uuid references skills(id) on delete set null,
  sort_order  smallint not null default 0,
  created_at  timestamptz not null default now()
);
create index job_requirements_job_idx on job_requirements(job_id, importance);

-- AI-derived scoring dimensions for a given job spec version (§36)
create table job_analyses (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid not null references jobs(id) on delete cascade,
  spec_version  integer not null,
  dimensions    jsonb not null default '[]'::jsonb,
  weights       jsonb not null default '{}'::jsonb,
  rationale     text,
  model         text not null,
  created_at    timestamptz not null default now(),
  unique (job_id, spec_version)
);

-- ---------------------------------------------------------------------
-- Resumes  (§10, §15)
-- ---------------------------------------------------------------------
create table resumes (
  id                uuid primary key default gen_random_uuid(),
  candidate_id      uuid not null references candidate_profiles(id) on delete cascade,
  storage_path      text not null,
  file_name         text not null,
  file_size         integer not null check (file_size > 0),
  page_count        smallint,
  checksum          text,
  status            resume_status not null default 'uploaded',
  extracted_text    text,
  extraction_error  text,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index resumes_candidate_idx on resumes(candidate_id, created_at desc);
create unique index resumes_one_active_idx on resumes(candidate_id) where is_active;

create table resume_analyses (
  id              uuid primary key default gen_random_uuid(),
  resume_id       uuid not null references resumes(id) on delete cascade,
  candidate_id    uuid not null references candidate_profiles(id) on delete cascade,
  ats_score       smallint check (ats_score between 0 and 100),
  ats             jsonb not null default '{}'::jsonb,
  sections        jsonb not null default '{}'::jsonb,
  extracted       jsonb not null default '{}'::jsonb,
  strengths       jsonb not null default '[]'::jsonb,
  improvements    jsonb not null default '[]'::jsonb,
  completed_parts text[] not null default '{}',
  failed_parts    text[] not null default '{}',
  model           text not null,
  created_at      timestamptz not null default now(),
  unique (resume_id)
);

-- ---------------------------------------------------------------------
-- Applications  (§30, §31)
-- ---------------------------------------------------------------------
create table applications (
  id                 uuid primary key default gen_random_uuid(),
  job_id             uuid not null references jobs(id) on delete cascade,
  candidate_id       uuid not null references candidate_profiles(id) on delete cascade,
  resume_id          uuid not null references resumes(id) on delete restrict,
  -- §16: historical applications stay bound to the data available at submission
  job_spec_snapshot  jsonb not null,
  resume_text_snapshot text not null default '',
  stage              application_stage not null default 'submitted',
  screening_status   screening_status  not null default 'queued',
  submitted_at       timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (job_id, candidate_id)
);
create index applications_job_idx on applications(job_id, stage);
create index applications_candidate_idx on applications(candidate_id, submitted_at desc);

create table application_analyses (
  id                 uuid primary key default gen_random_uuid(),
  application_id     uuid not null unique references applications(id) on delete cascade,
  requirement_matrix jsonb not null default '[]'::jsonb,
  skill_intelligence jsonb not null default '{}'::jsonb,
  experience_intel   jsonb not null default '{}'::jsonb,
  strengths          jsonb not null default '[]'::jsonb,
  concerns           jsonb not null default '[]'::jsonb,
  summary            text,
  semantic_signals   jsonb not null default '{}'::jsonb,
  completed_parts    text[] not null default '{}',
  failed_parts       text[] not null default '{}',
  model              text not null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Deterministic score, computed by application logic (§35)
create table application_scores (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references applications(id) on delete cascade,
  overall        numeric(5,2) not null check (overall between 0 and 100),
  category       match_category not null,
  components     jsonb not null default '{}'::jsonb,
  weights        jsonb not null default '{}'::jsonb,
  engine_version text not null,
  computed_at    timestamptz not null default now()
);
create index application_scores_rank_idx on application_scores(overall desc);

create table application_events (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  actor_id       uuid references profiles(id) on delete set null,
  from_stage     application_stage,
  to_stage       application_stage,
  kind           text not null default 'stage_change',
  note           text,
  created_at     timestamptz not null default now()
);
create index application_events_app_idx on application_events(application_id, created_at desc);

create table recruiter_notes (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  recruiter_id   uuid not null references profiles(id) on delete cascade,
  body           text not null,
  created_at     timestamptz not null default now()
);
create index recruiter_notes_app_idx on recruiter_notes(application_id, created_at desc);

create table application_tags (
  application_id uuid not null references applications(id) on delete cascade,
  tag            text not null,
  created_by     uuid references profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  primary key (application_id, tag)
);

-- ---------------------------------------------------------------------
-- Interview intelligence  (§41, §42, §43)
-- ---------------------------------------------------------------------
create table interview_kits (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  questions      jsonb not null default '[]'::jsonb,
  model          text not null,
  created_by     uuid references profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (application_id)
);

create table interview_preps (
  id           uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidate_profiles(id) on delete cascade,
  job_id       uuid not null references jobs(id) on delete cascade,
  questions    jsonb not null default '[]'::jsonb,
  model        text not null,
  created_at   timestamptz not null default now(),
  unique (candidate_id, job_id)
);

create table interview_practice (
  id            uuid primary key default gen_random_uuid(),
  candidate_id  uuid not null references candidate_profiles(id) on delete cascade,
  prep_id       uuid references interview_preps(id) on delete cascade,
  question      text not null,
  answer        text not null,
  feedback      jsonb not null default '{}'::jsonb,
  model         text,
  created_at    timestamptz not null default now()
);
create index interview_practice_cid_idx on interview_practice(candidate_id, created_at desc);

-- ---------------------------------------------------------------------
-- Notifications  (§55)
-- ---------------------------------------------------------------------
create table notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  kind       text not null,
  title      text not null,
  body       text,
  link       text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on notifications(user_id, created_at desc);
create index notifications_unread_idx on notifications(user_id) where read_at is null;

-- ---------------------------------------------------------------------
-- AI processing queue & observability  (§64, §66, §53)
-- ---------------------------------------------------------------------
create table ai_jobs (
  id            uuid primary key default gen_random_uuid(),
  kind          ai_job_kind   not null,
  ref_id        uuid          not null,
  status        ai_job_status not null default 'queued',
  attempts      smallint      not null default 0,
  max_attempts  smallint      not null default 4,
  payload       jsonb         not null default '{}'::jsonb,
  result        jsonb,
  last_error    text,
  scheduled_for timestamptz   not null default now(),
  started_at    timestamptz,
  finished_at   timestamptz,
  created_at    timestamptz   not null default now(),
  updated_at    timestamptz   not null default now()
);
-- §66: prevents duplicate in-flight requests for the same target
create unique index ai_jobs_inflight_idx on ai_jobs(kind, ref_id)
  where status in ('queued', 'processing', 'rate_limited');
create index ai_jobs_poll_idx on ai_jobs(status, scheduled_for);

create table ai_usage (
  id             uuid primary key default gen_random_uuid(),
  kind           ai_job_kind not null,
  model          text not null,
  prompt_tokens  integer not null default 0,
  output_tokens  integer not null default 0,
  latency_ms     integer,
  ok             boolean not null default true,
  error_code     text,
  created_at     timestamptz not null default now()
);
create index ai_usage_created_idx on ai_usage(created_at desc);

create table system_events (
  id         uuid primary key default gen_random_uuid(),
  level      text not null default 'info',
  source     text not null,
  message    text not null,
  context    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index system_events_created_idx on system_events(created_at desc);

-- Singleton row of admin-configurable AI settings (§54). Never holds secrets.
create table ai_settings (
  id             boolean primary key default true check (id),
  provider       text    not null default 'groq',
  model          text    not null default 'llama-3.3-70b-versatile',
  enabled        boolean not null default true,
  max_attempts   smallint not null default 4,
  backoff_ms     integer not null default 2000,
  features       jsonb   not null default '{
    "resume_analysis": true, "job_analysis": true, "screening": true,
    "interview_kit": true, "interview_prep": true, "practice_feedback": true,
    "comparison": true, "rewrite": true
  }'::jsonb,
  updated_at     timestamptz not null default now(),
  updated_by     uuid references profiles(id) on delete set null
);
insert into ai_settings (id) values (true) on conflict do nothing;

-- ---------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------
create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','candidate_profiles','jobs','resumes','applications',
    'application_analyses','ai_jobs'
  ] loop
    execute format(
      'create trigger %I_touch before update on %I for each row execute function touch_updated_at()',
      t, t);
  end loop;
end $$;

-- New auth user -> profile row (role assigned from signup metadata, default candidate)
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare assigned user_role;
begin
  assigned := coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'candidate');
  insert into public.profiles (id, email, full_name, role)
  values (new.id, lower(new.email), coalesce(new.raw_user_meta_data ->> 'full_name', ''), assigned)
  on conflict (id) do nothing;

  if assigned = 'candidate' then
    insert into public.candidate_profiles (user_id) values (new.id)
    on conflict (user_id) do nothing;
  end if;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
