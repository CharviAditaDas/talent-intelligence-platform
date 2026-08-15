/**
 * Demo data seeding (§60, §86).
 *
 * Creates a balanced, deliberately imperfect demo environment: strong,
 * moderate and weak matches; resumes of differing quality; applications
 * spread across pipeline stages. Every person, company and project here is
 * fictional.
 *
 * Screening runs through the real pipeline — the same scoring engine and the
 * same prompts a live application uses — so seeded scores are genuine
 * outputs, not hand-written numbers.
 *
 * Usage:  npx tsx scripts/seed.ts
 * Requires NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GROQ_API_KEY.
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before seeding.');
  process.exit(1);
}

const db = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

/* ------------------------------------------------------------------ */
/* Accounts                                                            */
/* ------------------------------------------------------------------ */

/**
 * Passwords are read from the environment, never hard-coded. Generate them
 * yourself and keep them out of version control:
 *   export SEED_PASSWORD_CANDIDATE="$(openssl rand -base64 24)"
 */
function passwordFor(role: string): string {
  const key = `SEED_PASSWORD_${role.toUpperCase()}`;
  const value = process.env[key];
  if (!value || value.length < 12) {
    console.error(`Set ${key} to a password of at least 12 characters before seeding.`);
    process.exit(1);
  }
  return value;
}

const ACCOUNTS = [
  { email: 'admin@demo.internal', role: 'admin', fullName: 'System Administrator' },
  { email: 'recruiter@demo.internal', role: 'recruiter', fullName: 'Daniel Okonjo' },
  { email: 'recruiter2@demo.internal', role: 'recruiter', fullName: 'Мaria Fontaine'.replace('М', 'M') },
  { email: 'candidate@demo.internal', role: 'candidate', fullName: 'Priya Raman' },
  { email: 'candidate2@demo.internal', role: 'candidate', fullName: 'Tomas Beaulieu' },
  { email: 'candidate3@demo.internal', role: 'candidate', fullName: 'Aisha Kadir' },
  { email: 'candidate4@demo.internal', role: 'candidate', fullName: 'Nikhil Sarangi' },
  { email: 'candidate5@demo.internal', role: 'candidate', fullName: 'Elena Vasquez' },
] as const;

/* ------------------------------------------------------------------ */
/* Roles                                                               */
/* ------------------------------------------------------------------ */

type JobStatus = 'draft' | 'active' | 'closed';

interface SeedJob {
  key: string;
  title: string;
  company: string;
  location: string;
  employment_type: string;
  status: JobStatus;
  experience_min: number;
  experience_max: number;
  education_level: string | null;
  description: string;
  responsibilities: string[];
  preferred_quals: string[];
  nice_to_have: string[];
}

const JOBS: SeedJob[] = [
  {
    key: 'data_eng',
    title: 'Senior Data Engineer',
    company: 'Meridian Analytics',
    location: 'Dubai, UAE',
    employment_type: 'full_time',
    status: 'active',
    experience_min: 4, experience_max: 8,
    education_level: "Bachelor's degree in Computer Science, Engineering or a numerate discipline",
    description: `We are building the data platform that powers pricing and risk decisions across the business.

You will own batch and streaming pipelines end to end: ingestion, transformation, orchestration, testing and the operational health of what you ship. Our stack is Python, Spark and Airflow on AWS, with Snowflake as the warehouse and dbt for modelling.

This is a hands-on engineering role. You will spend most of your time writing production code and reviewing others'. We care about correctness, idempotency and observability far more than about the number of tools someone has touched.`,
    responsibilities: [
      'Design, build and operate batch and streaming data pipelines in production',
      'Model warehouse datasets in dbt and maintain their tests and documentation',
      'Own pipeline reliability, including on-call rotation for data incidents',
      'Review code and mentor two junior engineers',
      'Work with analysts to turn ambiguous requirements into stable datasets',
    ],
    preferred_quals: [
      'Experience with Snowflake or an equivalent cloud warehouse',
      'Exposure to streaming systems such as Kafka or Kinesis',
      'Track record of reducing pipeline cost or runtime measurably',
    ],
    nice_to_have: [
      'Contributions to open-source data tooling',
      'Experience in financial services or another regulated industry',
    ],
  },
  {
    key: 'ml_eng',
    title: 'Machine Learning Engineer',
    company: 'Meridian Analytics',
    location: 'Remote (GMT+2 to GMT+5)',
    employment_type: 'full_time',
    status: 'active',
    experience_min: 3, experience_max: 7,
    education_level: "Bachelor's degree in a quantitative field",
    description: `You will take models from notebook to production and keep them healthy there.

The role sits between research and platform: you will work with scientists on model design, then own serving, monitoring, retraining and rollback. Python is the primary language. We use PyTorch, MLflow and Kubernetes, with feature data coming from the same Snowflake warehouse the data engineering team maintains.

We are explicitly not looking for someone who has only trained models offline. The hard part of this job is what happens after deployment.`,
    responsibilities: [
      'Productionise models, including serving infrastructure and rollback paths',
      'Build monitoring for data drift, model drift and prediction quality',
      'Own retraining pipelines and the decision criteria that trigger them',
      'Partner with data scientists on model design and evaluation',
    ],
    preferred_quals: [
      'Experience with MLflow, Weights & Biases or a comparable tracking system',
      'Kubernetes in production, not just locally',
      'Experience with A/B testing or online evaluation of models',
    ],
    nice_to_have: [
      'Published work or conference talks on applied ML',
      'Experience with feature stores',
    ],
  },
  {
    key: 'frontend',
    title: 'Frontend Engineer, Design Systems',
    company: 'Aperture Studio',
    location: 'Abu Dhabi, UAE',
    employment_type: 'full_time',
    status: 'active',
    experience_min: 2, experience_max: 6,
    education_level: null,
    description: `Aperture builds interfaces for regulated industries, where clarity matters more than flourish.

You will own our design system: the component library, the tokens, the documentation and the accessibility guarantees that come with them. Around forty engineers across four product teams depend on it, so API design and backwards compatibility are a real part of the job.

Our stack is TypeScript, React and Tailwind, with Storybook for documentation and Playwright for interaction tests. Accessibility is not a phase at the end here — WCAG 2.2 AA is the baseline for anything shipped.`,
    responsibilities: [
      'Own and evolve a component library used by four product teams',
      'Maintain design tokens and the theming layer across light and dark modes',
      'Write and maintain accessibility tests, including keyboard and screen reader paths',
      'Document components and migration paths for breaking changes',
    ],
    preferred_quals: [
      'Experience maintaining a shared component library or design system',
      'Working knowledge of WCAG 2.2 and assistive technology behaviour',
      'Experience with visual regression or interaction testing',
    ],
    nice_to_have: [
      'Design tooling experience such as Figma plugin development',
      'Experience with monorepo tooling',
    ],
  },
  {
    key: 'analyst',
    title: 'Product Analyst',
    company: 'Northwind Retail Group',
    location: 'Dubai, UAE',
    employment_type: 'full_time',
    status: 'closed',
    experience_min: 1, experience_max: 4,
    education_level: "Bachelor's degree",
    description: `This role has been filled and is retained here for reference.

The Product Analyst worked with the e-commerce team on funnel analysis, experiment design and weekly trading reviews, using SQL and Python against our warehouse.`,
    responsibilities: [
      'Analyse conversion funnels and surface actionable findings',
      'Design and read out A/B tests',
      'Maintain trading dashboards',
    ],
    preferred_quals: ['Experience with experimentation platforms'],
    nice_to_have: ['Retail or e-commerce domain experience'],
  },
];

/* ------------------------------------------------------------------ */
/* Resumes — deliberately varied in quality and fit                    */
/* ------------------------------------------------------------------ */

const RESUMES: Record<string, { fileName: string; text: string }> = {
  'candidate@demo.internal': {
    fileName: 'priya-raman-resume.pdf',
    text: `PRIYA RAMAN
Senior Data Engineer | Dubai, UAE | priya.raman@demo.internal | linkedin.com/in/priyaraman-demo

SUMMARY
Data engineer with six years building production pipelines in Python and Spark. Owned the
migration of a batch platform to streaming ingestion, cutting end-to-end latency from four
hours to under nine minutes.

EXPERIENCE

Senior Data Engineer, Halcyon Freight (2022 - present)
- Own eleven production Airflow DAGs processing 40M events nightly into Snowflake.
- Led migration from nightly batch to Kafka-based streaming ingestion; reduced end-to-end
  latency from 4 hours to 9 minutes and cut warehouse compute spend by 31%.
- Built dbt models covering the shipments and billing domains, with 240 tests in CI.
- Introduced data contracts between producing services and the warehouse, reducing
  schema-break incidents from roughly six per quarter to one.
- Mentor two junior engineers; run the weekly pipeline review.

Data Engineer, Corvus Payments (2019 - 2022)
- Built ingestion from twelve payment providers into a Redshift warehouse using Python.
- Wrote the reconciliation framework that flags settlement mismatches; still in use.
- On-call for data incidents on a four-week rotation.

SKILLS
Python (pandas, PySpark), SQL, Airflow, dbt, Kafka, Snowflake, Redshift, Docker,
Terraform, AWS (S3, Glue, EMR, Lambda), Great Expectations, Git

EDUCATION
BE Computer Science, BITS Pilani Dubai Campus, 2019

CERTIFICATIONS
AWS Certified Solutions Architect - Associate (2023)`,
  },
  'candidate2@demo.internal': {
    fileName: 'tomas-beaulieu-resume.pdf',
    text: `TOMAS BEAULIEU
Machine Learning Engineer | Lyon, France | tomas.beaulieu@demo.internal

PROFILE
ML engineer focused on getting models into production and keeping them there. Four years
across recommendation and forecasting systems.

EXPERIENCE

ML Engineer, Solstice Commerce (2021 - present)
- Own the serving stack for a recommendation model handling 2,000 requests per second.
- Built the drift monitoring system that compares live feature distributions against the
  training set; catches degradation roughly two weeks before offline metrics do.
- Implemented shadow deployment and automatic rollback; three bad models caught in 2024
  before reaching customers.
- Run retraining pipelines on Kubernetes with MLflow tracking.

Data Scientist, Solstice Commerce (2020 - 2021)
- Built demand forecasting models in PyTorch for 14,000 SKUs.
- Ran the A/B tests that validated the first production recommendation model.

SKILLS
Python, PyTorch, MLflow, Kubernetes, Docker, FastAPI, SQL, Airflow, Prometheus,
Grafana, scikit-learn, pandas

EDUCATION
MSc Applied Mathematics, Universite de Lyon, 2020
BSc Mathematics, Universite de Lyon, 2018`,
  },
  'candidate3@demo.internal': {
    fileName: 'aisha-kadir-resume.pdf',
    text: `AISHA KADIR
Frontend Engineer | Abu Dhabi, UAE | aisha.kadir@demo.internal

ABOUT
Frontend engineer, four years, mostly in component library and accessibility work.

EXPERIENCE

Frontend Engineer, Lantern Health (2022 - present)
- Maintain the shared component library used by three product squads; 60+ components.
- Rewrote the form primitives to meet WCAG 2.2 AA, including full keyboard and
  screen reader support. Cleared 34 outstanding accessibility defects.
- Set up Playwright interaction tests and Chromatic visual regression in CI.
- Author the migration guides when we ship breaking changes to the library.

Frontend Developer, Bright Path Learning (2021 - 2022)
- Built the student dashboard in React and TypeScript.
- Worked with the designer on the initial token system for colour and spacing.

SKILLS
TypeScript, React, Tailwind CSS, Storybook, Playwright, Chromatic, CSS, HTML,
Vite, Radix UI, Figma, Git, WCAG 2.2

EDUCATION
BSc Software Engineering, Khalifa University, 2021`,
  },
  'candidate4@demo.internal': {
    fileName: 'nikhil-sarangi-resume.pdf',
    text: `NIKHIL SARANGI
Software Engineer | Pune, India | nikhil.sarangi@demo.internal

SUMMARY
Software engineer with two years of backend experience. Interested in data engineering
and looking to move in that direction.

EXPERIENCE

Software Engineer, Vertex Systems (2023 - present)
- Build and maintain REST APIs in Python using Flask.
- Work with cloud technologies to deploy and monitor services.
- Write SQL queries for reporting requests from the operations team.
- Participated in migrating some services to containers.

Junior Developer, Vertex Systems (2022 - 2023)
- Fixed bugs across the internal admin tooling.
- Wrote unit tests for the billing module.

SKILLS
Python, Flask, SQL, MySQL, Git, Linux, basic Docker, cloud platforms

EDUCATION
BTech Information Technology, Savitribai Phule Pune University, 2022

PROJECTS
Expense tracker - a personal web app built with Flask and SQLite.`,
  },
  'candidate5@demo.internal': {
    fileName: 'elena-vasquez-resume.pdf',
    text: `ELENA VASQUEZ
Analytics Engineer | Madrid, Spain | elena.vasquez@demo.internal

SUMMARY
Analytics engineer, five years, bridging warehouse modelling and stakeholder analysis.
Strong SQL and dbt; growing Python.

EXPERIENCE

Analytics Engineer, Cadence Media (2021 - present)
- Own the dbt project: 180 models across subscriptions, content and advertising.
- Built the subscription cohort model used in board reporting.
- Reduced warehouse spend 22% by restructuring incremental models and clustering keys.
- Partner with four analysts to define metrics and keep definitions consistent.

Data Analyst, Cadence Media (2019 - 2021)
- Weekly trading reporting for the subscriptions business.
- Designed and read out fourteen A/B tests on the paywall.

SKILLS
SQL (advanced), dbt, Snowflake, Looker, Python (pandas), Git, Airflow (basic),
experiment design, statistics

EDUCATION
BSc Economics, Universidad Carlos III de Madrid, 2019`,
  },
};

/* ------------------------------------------------------------------ */
/* Application plan — spread across stages and fit levels              */
/* ------------------------------------------------------------------ */

const APPLICATIONS: Array<{ candidate: string; job: string; stage: string }> = [
  { candidate: 'candidate@demo.internal', job: 'data_eng', stage: 'shortlisted' },
  { candidate: 'candidate@demo.internal', job: 'ml_eng', stage: 'under_review' },
  { candidate: 'candidate2@demo.internal', job: 'ml_eng', stage: 'interview_1' },
  { candidate: 'candidate2@demo.internal', job: 'data_eng', stage: 'under_review' },
  { candidate: 'candidate3@demo.internal', job: 'frontend', stage: 'interview_2' },
  { candidate: 'candidate4@demo.internal', job: 'data_eng', stage: 'ai_screening' },
  { candidate: 'candidate4@demo.internal', job: 'frontend', stage: 'rejected' },
  { candidate: 'candidate5@demo.internal', job: 'data_eng', stage: 'under_review' },
  { candidate: 'candidate5@demo.internal', job: 'ml_eng', stage: 'ai_screening' },
];

/* ------------------------------------------------------------------ */

async function main() {
  console.log('Seeding demo environment\n');

  // --- Accounts -----------------------------------------------------
  const userIds = new Map<string, string>();
  for (const acct of ACCOUNTS) {
    const password = passwordFor(acct.role === 'candidate' ? 'candidate' : acct.role);
    const { data: created, error } = await db.auth.admin.createUser({
      email: acct.email,
      password,
      email_confirm: true,
      user_metadata: { role: acct.role, full_name: acct.fullName },
    });

    if (error && !/already/i.test(error.message)) throw error;

    let id = created?.user?.id;
    if (!id) {
      const { data: list } = await db.auth.admin.listUsers({ perPage: 200 });
      id = list?.users.find((u) => u.email === acct.email)?.id;
    }
    if (!id) throw new Error(`Could not resolve user id for ${acct.email}`);

    userIds.set(acct.email, id);

    // The auth trigger creates the profile; make role and name authoritative.
    await db.from('profiles').upsert({
      id, email: acct.email, full_name: acct.fullName, role: acct.role, is_active: true,
    }, { onConflict: 'id' });

    if (acct.role === 'candidate') {
      await db.from('candidate_profiles').upsert({ user_id: id }, { onConflict: 'user_id' });
    }
    console.log(`  account  ${acct.email.padEnd(28)} ${acct.role}`);
  }

  // --- Candidate profiles -------------------------------------------
  const candidateIds = new Map<string, string>();
  const PROFILE_DETAIL: Record<string, { location: string; headline: string; summary: string; years: number; phone: string }> = {
    'candidate@demo.internal': {
      location: 'Dubai, UAE', headline: 'Senior Data Engineer — streaming and warehouse modelling',
      summary: 'Six years building production data pipelines. Most recently led a batch-to-streaming migration that cut end-to-end latency from four hours to nine minutes.',
      years: 6, phone: '+971 50 000 0001',
    },
    'candidate2@demo.internal': {
      location: 'Lyon, France', headline: 'ML Engineer — production serving and monitoring',
      summary: 'Four years taking models from notebook to production, with a focus on drift monitoring and safe rollback.',
      years: 4, phone: '+33 6 00 00 00 02',
    },
    'candidate3@demo.internal': {
      location: 'Abu Dhabi, UAE', headline: 'Frontend Engineer — design systems and accessibility',
      summary: 'Four years maintaining shared component libraries, with deep accessibility work against WCAG 2.2 AA.',
      years: 4, phone: '+971 50 000 0003',
    },
    'candidate4@demo.internal': {
      location: 'Pune, India', headline: 'Software Engineer moving toward data engineering',
      summary: 'Two years of backend API work, now looking to move into data engineering.',
      years: 2, phone: '+91 90000 00004',
    },
    'candidate5@demo.internal': {
      location: 'Madrid, Spain', headline: 'Analytics Engineer — dbt and warehouse modelling',
      summary: 'Five years across analytics and warehouse modelling. Strong SQL and dbt, growing Python.',
      years: 5, phone: '+34 600 000 005',
    },
  };

  for (const [email, detail] of Object.entries(PROFILE_DETAIL)) {
    const userId = userIds.get(email)!;
    const { data } = await db.from('candidate_profiles')
      .update({
        location: detail.location, headline: detail.headline, summary: detail.summary,
        years_experience: detail.years, phone: detail.phone,
        linkedin_url: `https://linkedin.com/in/${email.split('@')[0]}-demo`,
        completeness: 80,
      })
      .eq('user_id', userId).select('id').single();
    if (data) candidateIds.set(email, data.id);
  }
  console.log(`\n  ${candidateIds.size} candidate profiles`);

  // --- Resumes ------------------------------------------------------
  // Text is inserted directly; there is no PDF to store for seeded data, so
  // the storage path is marked as seeded and the viewer degrades gracefully.
  const resumeIds = new Map<string, string>();
  for (const [email, resume] of Object.entries(RESUMES)) {
    const candidateId = candidateIds.get(email);
    if (!candidateId) continue;

    await db.from('resumes').update({ is_active: false }).eq('candidate_id', candidateId);

    const id = randomUUID();
    const { error } = await db.from('resumes').insert({
      id,
      candidate_id: candidateId,
      storage_path: `seed/${id}.pdf`,
      file_name: resume.fileName,
      file_size: Buffer.byteLength(resume.text, 'utf8'),
      page_count: 1,
      status: 'queued',
      extracted_text: resume.text,
      is_active: true,
    });
    if (error) throw error;
    resumeIds.set(email, id);
  }
  console.log(`  ${resumeIds.size} resumes`);

  // --- Jobs ---------------------------------------------------------
  const jobIds = new Map<string, string>();
  const recruiterA = userIds.get('recruiter@demo.internal')!;
  const recruiterB = userIds.get('recruiter2@demo.internal')!;

  for (const job of JOBS) {
    const owner = job.key === 'frontend' ? recruiterB : recruiterA;
    const status = job.status;
    const { data, error } = await db.from('jobs').insert({
      recruiter_id: owner,
      title: job.title, company: job.company, location: job.location,
      employment_type: job.employment_type, description: job.description,
      responsibilities: job.responsibilities,
      preferred_quals: job.preferred_quals,
      nice_to_have: job.nice_to_have,
      experience_min: job.experience_min, experience_max: job.experience_max,
      education_level: job.education_level, status,
      published_at: status !== 'draft' ? new Date(Date.now() - 12 * 86400000).toISOString() : null,
      closed_at: status === 'closed' ? new Date(Date.now() - 2 * 86400000).toISOString() : null,
    }).select('id').single();
    if (error) throw error;
    jobIds.set(job.key, data.id);
    console.log(`  role     ${job.title}`);
  }

  // --- Queue the real AI pipeline -----------------------------------
  // Specifications are derived first: screening depends on job_requirements
  // existing, so ordering matters here.
  let queued = 0;
  for (const [kind, ids] of [
    ['job_analysis', Array.from(jobIds.values())],
    ['resume_analysis', Array.from(resumeIds.values())],
  ] as const) {
    for (const id of ids) {
      const { error } = await db.from('ai_jobs').insert({ kind, ref_id: id });
      if (error && !/duplicate key/i.test(error.message)) {
        throw new Error(`Could not queue ${kind} for ${id}: ${error.message}`);
      }
      queued += 1;
    }
  }
  console.log(`\n  queued ${queued} analyses`);

  // --- Applications --------------------------------------------------
  let appCount = 0;
  for (const plan of APPLICATIONS) {
    const candidateId = candidateIds.get(plan.candidate);
    const jobId = jobIds.get(plan.job);
    const resumeId = resumeIds.get(plan.candidate);
    if (!candidateId || !jobId || !resumeId) continue;

    const job = JOBS.find((j) => j.key === plan.job)!;
    const resumeText = RESUMES[plan.candidate].text;
    const daysAgo = 1 + Math.floor(Math.random() * 9);

    const { data, error } = await db.from('applications').insert({
      job_id: jobId, candidate_id: candidateId, resume_id: resumeId,
      job_spec_snapshot: {
        spec_version: 1, title: job.title, company: job.company,
        description: job.description, responsibilities: job.responsibilities,
        experience_min: job.experience_min, experience_max: job.experience_max,
        education_level: job.education_level,
        captured_at: new Date(Date.now() - daysAgo * 86400000).toISOString(),
      },
      resume_text_snapshot: resumeText,
      stage: plan.stage,
      screening_status: 'queued',
      submitted_at: new Date(Date.now() - daysAgo * 86400000).toISOString(),
    }).select('id').single();

    if (error) {
      if (error.code === '23505') continue;
      throw error;
    }

    await db.from('application_events').insert({
      application_id: data.id, to_stage: 'submitted', kind: 'submitted',
      note: 'Application submitted.',
      created_at: new Date(Date.now() - daysAgo * 86400000).toISOString(),
    });

    const { error: queueError } = await db
      .from('ai_jobs').insert({ kind: 'application_screening', ref_id: data.id });
    if (queueError && !/duplicate key/i.test(queueError.message)) {
      throw new Error(`Could not queue screening for ${data.id}: ${queueError.message}`);
    }
    appCount += 1;
  }
  console.log(`  ${appCount} applications queued for screening`);

  // --- Recruiter annotations ----------------------------------------
  const { data: shortlisted } = await db
    .from('applications').select('id').eq('stage', 'shortlisted').limit(1);
  if (shortlisted?.[0]) {
    await db.from('recruiter_notes').insert({
      application_id: shortlisted[0].id, recruiter_id: recruiterA,
      body: 'Strong streaming background and the cost reduction is quantified, which is rare. Want to probe the data contracts work — that is the closest thing to what we need next quarter.',
    });
    await db.from('application_tags').insert([
      { application_id: shortlisted[0].id, tag: 'streaming', created_by: recruiterA },
      { application_id: shortlisted[0].id, tag: 'priority', created_by: recruiterA },
    ]);
  }

  await db.from('system_events').insert({
    level: 'info', source: 'seed',
    message: 'Demo environment seeded.',
    context: { jobs: jobIds.size, applications: appCount, candidates: candidateIds.size },
  });

  const { count: pending } = await db
    .from('ai_jobs').select('id', { count: 'exact', head: true }).eq('status', 'queued');

  console.log(`
Seeding complete. ${pending ?? 0} AI jobs are queued and waiting.

Next: run the worker until the queue drains, so screening produces real
assessments through the same pipeline a live application uses.

  curl -X POST <your-deployed-url>/api/worker/drain \\
       -H "Authorization: Bearer $AI_WORKER_SECRET"

Repeat until it reports { processed: 0 }. Expect roughly ${jobIds.size + resumeIds.size + appCount}
operations in total, and note that the Groq free tier is rate limited — the
queue backs off and retries on its own.
`);
}

main().catch((err) => {
  console.error('\nSeeding failed:', err);
  process.exit(1);
});
