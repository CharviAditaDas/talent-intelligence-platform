/**
 * Authorization coverage tests.
 *
 * These do not need a live database. They assert structural properties of the
 * RLS policy file and the guard module that, if violated, would open a real
 * hole — the kind of regression that is easy to introduce and hard to spot in
 * review because the UI keeps working.
 *
 * Live cross-tenant probing still has to be done against a real Supabase
 * project; see the security checklist in DEPLOY.md.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const rls = readFileSync(join(root, 'supabase/migrations/0002_rls.sql'), 'utf8');
const schema = readFileSync(join(root, 'supabase/migrations/0001_schema.sql'), 'utf8');
const guards = readFileSync(join(root, 'lib/auth/guards.ts'), 'utf8');

let pass = 0;
let fail = 0;
const failures: string[] = [];

function check(name: string, condition: boolean, detail = '') {
  if (condition) {
    pass += 1;
    console.log(`  PASS  ${name}`);
  } else {
    fail += 1;
    failures.push(name);
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function section(title: string) {
  console.log(`\n[${title}]`);
}

/* ------------------------------------------------------------------ */
section('RLS enablement');

const SENSITIVE_TABLES = [
  'profiles', 'candidate_profiles', 'candidate_experience', 'candidate_education',
  'candidate_projects', 'candidate_certifications', 'candidate_skills',
  'jobs', 'job_requirements', 'job_analyses', 'resumes', 'resume_analyses',
  'applications', 'application_analyses', 'application_scores', 'application_events',
  'recruiter_notes', 'application_tags', 'interview_kits', 'interview_preps',
  'interview_practice', 'notifications', 'ai_jobs', 'ai_usage', 'system_events', 'ai_settings',
];

for (const t of SENSITIVE_TABLES) {
  check(`${t} is in the RLS enable list`, rls.includes(`'${t}'`));
}
check('RLS is FORCEd, so table owners are not exempt', rls.includes('force row level security'));

/* ------------------------------------------------------------------ */
section('Candidate isolation (§94)');

check('candidate_profiles owner policy scopes to auth.uid()',
  /cp_owner_all[\s\S]{0,200}user_id = auth\.uid\(\)/.test(rls));

check('child tables scope to my_candidate_id()',
  rls.includes('candidate_id = my_candidate_id()'));

check('my_candidate_id derives from auth.uid, not a parameter',
  /my_candidate_id[\s\S]{0,300}where user_id = auth\.uid\(\)/.test(rls));

check('recruiter candidate access requires an application',
  /candidate_visible_to_me[\s\S]{0,400}from applications a[\s\S]{0,200}j\.recruiter_id = auth\.uid\(\)/.test(rls));

check('no policy grants recruiters unconditional candidate SELECT',
  !/cp_recruiter_read on candidate_profiles for select\s*\n?\s*using \(is_recruiter\(\)\)/.test(rls));

/* ------------------------------------------------------------------ */
section('Recruiter isolation (§21)');

check('owns_job checks recruiter_id against auth.uid()',
  /owns_job[\s\S]{0,300}recruiter_id = auth\.uid\(\)/.test(rls));

check('owns_application joins through jobs to the owning recruiter',
  /owns_application[\s\S]{0,400}join jobs j on j\.id = a\.job_id[\s\S]{0,200}j\.recruiter_id = auth\.uid\(\)/.test(rls));

check('application select policy for recruiters uses owns_application',
  rls.includes('apps_recruiter_read on applications for select using (owns_application(id))'));

check('recruiter notes are scoped to the authoring recruiter',
  /notes_recruiter_all[\s\S]{0,250}recruiter_id = auth\.uid\(\)/.test(rls));

/* ------------------------------------------------------------------ */
section('Candidate cannot read recruiter-internal data (§57)');

/**
 * Parse policy statements properly rather than matching within a character
 * window. A window can silently bleed into the following statement, which
 * produces both false alarms and — more dangerously — false reassurance.
 */
interface Policy { name: string; table: string; command: string; body: string }

function parsePolicies(sql: string): Policy[] {
  const out: Policy[] = [];
  const re = /create policy\s+(\w+)\s+on\s+(\w+)\s+for\s+(\w+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    // A statement ends at the next `create policy` or the next top-level `;`
    const start = m.index;
    const nextMatch = sql.slice(start + 1).search(/create policy/i);
    const sliceEnd = nextMatch === -1 ? sql.length : start + 1 + nextMatch;
    const stmt = sql.slice(start, sliceEnd);
    const semi = stmt.indexOf(';');
    out.push({
      name: m[1],
      table: m[2],
      command: m[3].toLowerCase(),
      body: semi === -1 ? stmt : stmt.slice(0, semi + 1),
    });
  }
  return out;
}

const policies = parsePolicies(rls);
check('policy parser found the expected policy volume', policies.length >= 40,
  `parsed ${policies.length}`);

/** Policies on a table that grant access via the candidate identity. */
function candidateReachable(table: string): Policy[] {
  return policies.filter((p) => p.table === table && p.body.includes('my_candidate_id'));
}

check('recruiter_notes has no candidate-reachable policy',
  candidateReachable('recruiter_notes').length === 0,
  candidateReachable('recruiter_notes').map((p) => p.name).join(', '));

check('application_tags has no candidate-reachable policy',
  candidateReachable('application_tags').length === 0,
  candidateReachable('application_tags').map((p) => p.name).join(', '));

check('interview_kits has no candidate-reachable policy',
  candidateReachable('interview_kits').length === 0,
  candidateReachable('interview_kits').map((p) => p.name).join(', '));

check('job_analyses has no candidate-reachable policy',
  candidateReachable('job_analyses').length === 0,
  candidateReachable('job_analyses').map((p) => p.name).join(', '));

check('interview_kits is reachable only through application ownership',
  policies.filter((p) => p.table === 'interview_kits')
    .every((p) => p.body.includes('owns_application') || p.body.includes('is_admin')));

check('ai_jobs is admin-only',
  policies.filter((p) => p.table === 'ai_jobs').every((p) => p.body.includes('is_admin')));

check('system_events is admin-only',
  policies.filter((p) => p.table === 'system_events').every((p) => p.body.includes('is_admin')));

/**
 * Tables whose policies are generated inside a `do $$ ... $$` loop via
 * execute format(). Static parsing cannot see these, so resolve the loop's
 * table list explicitly and verify the generated policy bodies separately.
 */
function dynamicPolicyTables(sql: string): { tables: string[]; bodies: string[] } {
  const loopStart = sql.indexOf("'candidate_experience','candidate_education','candidate_projects'");
  if (loopStart === -1) return { tables: [], bodies: [] };
  const block = sql.slice(loopStart, sql.indexOf('end $$;', loopStart));
  const listEnd = block.indexOf('] loop');
  const tables = Array.from(block.slice(0, listEnd).matchAll(/'(\w+)'/g)).map((m) => m[1]);
  const bodies = Array.from(block.matchAll(/create policy [\s\S]*?;/g)).map((m) => m[0]);
  return { tables, bodies };
}

const dynamic = dynamicPolicyTables(rls);

check('dynamic loop covers all candidate child tables',
  ['candidate_experience', 'candidate_education', 'candidate_projects',
   'candidate_certifications', 'candidate_skills'].every((t) => dynamic.tables.includes(t)),
  `covers ${dynamic.tables.join(', ')}`);

check('dynamic owner policy scopes to my_candidate_id()',
  dynamic.bodies.some((b) => b.includes('_owner_all') && b.includes('candidate_id = my_candidate_id()')));

check('dynamic recruiter policy requires application visibility',
  dynamic.bodies.some((b) => b.includes('_recruiter_read')
    && b.includes('is_recruiter() and candidate_visible_to_me(candidate_id)')));

check('dynamic recruiter policy is SELECT-only',
  dynamic.bodies.filter((b) => b.includes('_recruiter_read')).every((b) => b.includes('for select')));

check('every sensitive table has a policy, static or dynamic',
  SENSITIVE_TABLES.every((t) =>
    policies.some((p) => p.table === t) || dynamic.tables.includes(t)),
  SENSITIVE_TABLES.filter((t) =>
    !policies.some((p) => p.table === t) && !dynamic.tables.includes(t)).join(', '));

/* ------------------------------------------------------------------ */
section('Application immutability (§33)');

check('no DELETE policy grants candidates application removal',
  !/on applications for delete/.test(rls));

check('candidate INSERT policy requires an active job',
  /apps_candidate_insert[\s\S]{0,400}j\.status = 'active'/.test(rls));

check('candidate INSERT policy requires ownership of the resume',
  /apps_candidate_insert[\s\S]{0,500}r\.candidate_id = my_candidate_id\(\)/.test(rls));

check('candidates have no UPDATE policy on applications',
  !/apps_candidate_update/.test(rls));

/* ------------------------------------------------------------------ */
section('Storage authorization (§63)');

check('resumes bucket is created private', /'resumes'[\s\S]{0,120}false/.test(rls));
check('bucket restricts mime type to PDF', rls.includes("array['application/pdf']"));
check('object owner policy checks the uid path prefix',
  /storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/.test(rls));
check('recruiter object read requires a linked application',
  /resume_obj_recruiter_read[\s\S]{0,500}join applications a on a\.resume_id = r\.id/.test(rls));

/* ------------------------------------------------------------------ */
section('Public exposure (§18)');

check('public job read is limited to active status',
  rls.includes("jobs_public_read on jobs for select\n  using (status = 'active')"));

check('job requirements are public only for active jobs',
  /jobreq_public_read[\s\S]{0,200}j\.status = 'active'/.test(rls));

/* ------------------------------------------------------------------ */
section('Helper function safety');

const definerCount = (rls.match(/security definer/g) ?? []).length;
check('helper predicates are SECURITY DEFINER to avoid policy recursion', definerCount >= 6,
  `found ${definerCount}`);

check('helpers pin search_path against injection',
  (rls.match(/set search_path = public/g) ?? []).length >= 6);

check('auth_role only returns a role for active accounts',
  /auth_role[\s\S]{0,200}is_active/.test(rls));

/* ------------------------------------------------------------------ */
section('Guard module (API layer)');

check('requireRole rejects roles outside the allow list',
  /requireRole[\s\S]{0,300}!allowed\.includes\(user\.role\)[\s\S]{0,120}403/.test(guards));

check('inactive accounts resolve to no session',
  /!profile\.is_active[\s\S]{0,40}return null/.test(guards));

check('cross-tenant application access returns 404, not 403',
  (guards.match(/AuthzError\(404, 'Application not found\.'\)/g) ?? []).length >= 2);

check('cross-tenant job access returns 404, not 403',
  (guards.match(/AuthzError\(404, 'Job not found\.'\)/g) ?? []).length >= 2);

check('errorResponse never leaks internals to the client',
  /errorResponse[\s\S]{0,400}Something went wrong/.test(guards)
  && !/errorResponse[\s\S]{0,400}err\.stack/.test(guards));

check('guards module is server-only', guards.startsWith("import 'server-only';"));

/* ------------------------------------------------------------------ */
section('Schema integrity');

check('one active resume per candidate is enforced by a partial unique index',
  /resumes_one_active_idx on resumes\(candidate_id\) where is_active/.test(schema));

check('duplicate applications are blocked by a unique constraint',
  /unique \(job_id, candidate_id\)/.test(schema));

check('duplicate in-flight AI jobs are blocked by a partial unique index',
  /ai_jobs_inflight_idx[\s\S]{0,160}where status in \('queued', 'processing', 'rate_limited'\)/.test(schema));

check('applications snapshot the job spec for historical stability',
  /job_spec_snapshot\s+jsonb\s+not null/.test(schema));

check('applications snapshot the resume text',
  /resume_text_snapshot text not null/.test(schema));

check('scores are constrained to 0-100', /overall\s+numeric\(5,2\) not null check \(overall between 0 and 100\)/.test(schema));

check('resume file size must be positive', /file_size\s+integer\s+not null check \(file_size > 0\)/.test(schema));

check('ai_settings holds no credential columns',
  !/api_key|secret|token|password/i.test(schema.slice(schema.indexOf('create table ai_settings'), schema.indexOf('create table ai_settings') + 900)));

/* ------------------------------------------------------------------ */
console.log(`\n${'='.repeat(52)}`);
console.log(`${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`  - ${f}`);
}
console.log('='.repeat(52));
process.exit(fail ? 1 : 0);
