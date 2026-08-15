import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { structured, AiError } from './groq';
import {
  jobAnalysisPrompt, jobAnalysisSchema,
  resumeAnalysisPrompt, resumeAnalysisSchema,
  screeningPrompt, screeningSchema,
  candidateMatchPrompt, candidateMatchSchema,
  interviewKitPrompt, interviewKitSchema,
  interviewPrepPrompt, interviewPrepSchema,
  practiceFeedbackPrompt, practiceFeedbackSchema,
  comparisonPrompt, comparisonSchema,
  rewritePrompt, rewriteSchema,
} from './prompts';
import { computeScore, type ScoredRequirement } from '@/lib/scoring/engine';

type Kind =
  | 'resume_parse' | 'resume_analysis' | 'job_analysis' | 'application_screening'
  | 'interview_kit' | 'interview_prep' | 'practice_feedback' | 'comparison' | 'rewrite';

interface Settings {
  enabled: boolean;
  model: string;
  max_attempts: number;
  backoff_ms: number;
  features: Record<string, boolean>;
}

async function settings(): Promise<Settings> {
  const db = createAdminClient();
  const { data } = await db.from('ai_settings').select('*').eq('id', true).single();
  return {
    enabled: data?.enabled ?? true,
    model: data?.model ?? process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile',
    max_attempts: data?.max_attempts ?? 4,
    backoff_ms: data?.backoff_ms ?? 2000,
    features: data?.features ?? {},
  };
}

async function recordUsage(kind: Kind, model: string, meta: { promptTokens: number; outputTokens: number; latencyMs: number }, ok: boolean, errorCode?: string) {
  const db = createAdminClient();
  await db.from('ai_usage').insert({
    kind, model,
    prompt_tokens: meta.promptTokens,
    output_tokens: meta.outputTokens,
    latency_ms: meta.latencyMs,
    ok, error_code: errorCode ?? null,
  });
}

async function logEvent(level: 'info' | 'warn' | 'error', source: string, message: string, context: Record<string, unknown> = {}) {
  const db = createAdminClient();
  await db.from('system_events').insert({ level, source, message, context });
}

/* ==================================================================== */
/* Queue (§64, §66)                                                     */
/* ==================================================================== */

/**
 * Enqueue work. The partial unique index on (kind, ref_id) for in-flight
 * rows means a double-click cannot create two screenings for one
 * application — the second insert conflicts and is ignored.
 */
export async function enqueue(kind: Kind, refId: string, payload: Record<string, unknown> = {}) {
  const db = createAdminClient();
  const { error } = await db.from('ai_jobs').insert({ kind, ref_id: refId, payload });
  // A duplicate is the partial unique index doing its job — the work is
  // already in flight, so this is success, not failure.
  if (error && !/duplicate key/i.test(error.message)) {
    await logEvent('error', `ai.enqueue.${kind}`, 'Could not queue AI work.', {
      ref: refId, message: error.message, code: error.code,
    }).catch(() => {});
    throw error;
  }
  return { queued: true };
}

/**
 * Claim and run the next batch of due jobs. Called by the worker route.
 * Returns a summary rather than throwing, so one poisoned job cannot stall
 * the queue.
 */
export async function drainQueue(limit = 5) {
  const db = createAdminClient();
  const cfg = await settings();
  if (!cfg.enabled) return { processed: 0, skipped: 'ai_disabled' as const };

  const { data: due, error: queueError } = await db
    .from('ai_jobs')
    .select('*')
    .in('status', ['queued', 'rate_limited'])
    .lte('scheduled_for', new Date().toISOString())
    .order('created_at', { ascending: true })
    .limit(limit);

  // An unreadable queue and an empty queue are completely different problems,
  // and reporting both as { processed: 0 } makes a credential failure look
  // like normal idle behaviour. Surface the error instead of hiding it.
  if (queueError) {
    await logEvent('error', 'ai.queue', 'Could not read the AI job queue.', {
      message: queueError.message, code: queueError.code,
    }).catch(() => {});
    throw new Error(`AI queue unreadable: ${queueError.message}`);
  }

  if (!due || due.length === 0) return { processed: 0 };

  let processed = 0;
  for (const job of due) {
    // Optimistic claim: only one worker can move a row out of queued.
    const { data: claimed } = await db
      .from('ai_jobs')
      .update({ status: 'processing', started_at: new Date().toISOString(), attempts: job.attempts + 1 })
      .eq('id', job.id)
      .in('status', ['queued', 'rate_limited'])
      .select('id')
      .maybeSingle();
    if (!claimed) continue;

    try {
      const result = await runJob(job.kind as Kind, job.ref_id, job.payload ?? {}, cfg);
      await db.from('ai_jobs').update({
        status: 'completed', result, finished_at: new Date().toISOString(), last_error: null,
      }).eq('id', job.id);
      processed += 1;
    } catch (err) {
      await handleFailure(job, err, cfg);
    }
  }
  return { processed };
}

async function handleFailure(job: { id: string; kind: string; ref_id: string; attempts: number }, err: unknown, cfg: Settings) {
  const db = createAdminClient();
  const aiErr = err instanceof AiError ? err : new AiError('unknown', String(err));
  const attempts = job.attempts + 1;
  const canRetry = aiErr.retryable && attempts < cfg.max_attempts;

  if (canRetry) {
    // Exponential backoff, honouring Retry-After when Groq supplies one.
    const backoff = aiErr.retryAfterMs ?? cfg.backoff_ms * 2 ** (attempts - 1);
    await db.from('ai_jobs').update({
      status: aiErr.kind === 'rate_limit' ? 'rate_limited' : 'queued',
      scheduled_for: new Date(Date.now() + backoff).toISOString(),
      last_error: `${aiErr.kind}: ${aiErr.message}`,
    }).eq('id', job.id);
    await logEvent('warn', `ai.${job.kind}`, `Retrying after ${aiErr.kind}`, { ref: job.ref_id, attempts });
    return;
  }

  await db.from('ai_jobs').update({
    status: 'failed',
    finished_at: new Date().toISOString(),
    last_error: `${aiErr.kind}: ${aiErr.message}`,
  }).eq('id', job.id);
  await logEvent('error', `ai.${job.kind}`, aiErr.message, { ref: job.ref_id, kind: aiErr.kind });

  // §65: mark the target as failed WITHOUT destroying anything already stored.
  if (job.kind === 'application_screening') {
    await db.from('applications').update({ screening_status: 'failed' }).eq('id', job.ref_id);
  }
  if (job.kind === 'resume_analysis') {
    await db.from('resumes').update({ status: 'requires_review' }).eq('id', job.ref_id);
  }
}

async function runJob(kind: Kind, refId: string, payload: Record<string, unknown>, cfg: Settings) {
  switch (kind) {
    case 'job_analysis': return analyseJob(refId, cfg);
    case 'resume_analysis': return analyseResume(refId, cfg);
    case 'application_screening': return screenApplication(refId, cfg);
    case 'interview_kit': return buildInterviewKit(refId, cfg);
    case 'interview_prep': return buildInterviewPrep(refId, String(payload.jobId), cfg);
    default: throw new AiError('unknown', `No handler for job kind ${kind}.`);
  }
}

/* ==================================================================== */
/* Operations                                                           */
/* ==================================================================== */

export async function analyseJob(jobId: string, cfg?: Settings) {
  const c = cfg ?? await settings();
  const db = createAdminClient();
  const { data: job } = await db.from('jobs').select('*').eq('id', jobId).single();
  if (!job) throw new AiError('unknown', 'Job not found.');

  const prompt = jobAnalysisPrompt({
    title: job.title, company: job.company, description: job.description,
    responsibilities: job.responsibilities ?? [],
    preferred: job.preferred_quals ?? [], niceToHave: job.nice_to_have ?? [],
    experienceMin: job.experience_min, experienceMax: job.experience_max,
    educationLevel: job.education_level,
  });

  const { data, meta } = await structured({ ...prompt, schema: jobAnalysisSchema, model: c.model });
  await recordUsage('job_analysis', meta.model, meta, true);

  // Replace the derived requirement set for this spec version.
  await db.from('job_requirements').delete().eq('job_id', jobId);
  if (data.requirements.length > 0) {
    await db.from('job_requirements').insert(
      data.requirements.map((r, i) => ({
        job_id: jobId, label: r.label, kind: r.kind,
        importance: r.importance, detail: r.detail, sort_order: i,
      })),
    );
  }

  await db.from('job_analyses').upsert({
    job_id: jobId, spec_version: job.spec_version,
    dimensions: data.requirements, weights: data.weights,
    rationale: data.rationale, model: meta.model,
  }, { onConflict: 'job_id,spec_version' });

  return { requirements: data.requirements.length, seniority: data.seniority };
}

export async function analyseResume(resumeId: string, cfg?: Settings) {
  const c = cfg ?? await settings();
  const db = createAdminClient();
  const { data: resume } = await db.from('resumes').select('*').eq('id', resumeId).single();
  if (!resume) throw new AiError('unknown', 'Resume not found.');
  if (!resume.extracted_text || resume.extracted_text.trim().length < 40) {
    await db.from('resumes').update({
      status: 'requires_review',
      extraction_error: 'The PDF contained too little machine-readable text to analyse. It may be a scan or an image export.',
    }).eq('id', resumeId);
    throw new AiError('refused', 'Resume text is empty or unreadable.');
  }

  await db.from('resumes').update({ status: 'processing' }).eq('id', resumeId);

  const prompt = resumeAnalysisPrompt(resume.extracted_text);
  const { data, meta } = await structured({ ...prompt, schema: resumeAnalysisSchema, model: c.model, maxTokens: 6000 });
  await recordUsage('resume_analysis', meta.model, meta, true);

  await db.from('resume_analyses').upsert({
    resume_id: resumeId,
    candidate_id: resume.candidate_id,
    ats_score: Math.round(data.ats.score),
    ats: data.ats,
    sections: data.sections,
    extracted: data.extracted,
    strengths: data.strengths,
    improvements: data.improvements,
    completed_parts: ['ats', 'extraction', 'sections', 'recommendations'],
    failed_parts: [],
    model: meta.model,
  }, { onConflict: 'resume_id' });

  await db.from('resumes').update({ status: 'analyzed' }).eq('id', resumeId);

  // Keep the candidate's structured profile in step with the active resume.
  if (resume.is_active && data.extracted.years_experience != null) {
    await db.from('candidate_profiles')
      .update({ years_experience: data.extracted.years_experience })
      .eq('id', resume.candidate_id);
  }

  await notify(resume.candidate_id, 'candidate', {
    kind: 'resume_analyzed',
    title: 'Resume analysis ready',
    body: `ATS readability scored ${Math.round(data.ats.score)}/100.`,
    link: '/candidate/resume',
  });

  return { ats: data.ats.score, skills: data.extracted.skills.length };
}

/**
 * The core screening path. Note the ordering: the model produces evidence
 * states, then computeScore() — plain arithmetic — produces the number.
 * The model never sees or influences the final score directly.
 */
export async function screenApplication(applicationId: string, cfg?: Settings) {
  const c = cfg ?? await settings();
  const db = createAdminClient();

  const { data: app } = await db
    .from('applications')
    .select('*, jobs(*), candidate_profiles(*)')
    .eq('id', applicationId)
    .single();
  if (!app) throw new AiError('unknown', 'Application not found.');

  await db.from('applications').update({ screening_status: 'processing' }).eq('id', applicationId);

  const { data: requirements } = await db
    .from('job_requirements').select('*').eq('job_id', app.job_id).order('sort_order');

  const job = app.jobs as { title: string; company: string; description: string; experience_min: number | null; experience_max: number | null };
  const candidate = app.candidate_profiles as { summary: string | null; years_experience: number | null };
  const reqList = (requirements ?? []).map((r) => ({
    id: r.id, label: r.label, kind: r.kind, importance: r.importance, detail: r.detail,
  }));

  const prompt = screeningPrompt({
    jobTitle: job.title, jobCompany: job.company, jobDescription: job.description,
    requirements: reqList,
    resumeText: app.resume_text_snapshot,
    candidateSummary: candidate?.summary ?? null,
  });

  const { data, meta } = await structured({ ...prompt, schema: screeningSchema, model: c.model, maxTokens: 6000 });
  await recordUsage('application_screening', meta.model, meta, true);

  // Align model output back onto the authoritative requirement list. Any
  // requirement the model failed to return defaults to not_demonstrated
  // rather than being silently dropped from the score.
  const byId = new Map(data.requirement_matrix.map((m) => [m.requirement_id, m]));
  const scored: ScoredRequirement[] = reqList.map((r) => {
    const m = byId.get(r.id);
    return {
      id: r.id, label: r.label, kind: r.kind,
      importance: r.importance as ScoredRequirement['importance'],
      state: (m?.state ?? 'not_demonstrated') as ScoredRequirement['state'],
      evidence: m?.evidence ?? null,
    };
  });

  const { data: analysis } = await db
    .from('job_analyses').select('weights').eq('job_id', app.job_id).order('spec_version', { ascending: false }).limit(1).maybeSingle();

  const score = computeScore({
    requirements: scored,
    semanticFit: data.semantic_fit,
    candidateYears: candidate?.years_experience ?? null,
    jobMinYears: job.experience_min,
    jobMaxYears: job.experience_max,
    weights: (analysis?.weights ?? null) as never,
  });

  const matrix = scored.map((s) => {
    const m = byId.get(s.id);
    return { ...s, reasoning: m?.reasoning ?? 'No assessment returned for this requirement.' };
  });

  await db.from('application_analyses').upsert({
    application_id: applicationId,
    requirement_matrix: matrix,
    skill_intelligence: data.skill_intelligence,
    experience_intel: data.experience_intelligence,
    strengths: data.strengths,
    concerns: data.concerns,
    summary: data.summary,
    semantic_signals: { semantic_fit: data.semantic_fit },
    completed_parts: ['matrix', 'skills', 'experience', 'summary'],
    failed_parts: [],
    model: meta.model,
  }, { onConflict: 'application_id' });

  await db.from('application_scores').upsert({
    application_id: applicationId,
    overall: score.overall,
    category: score.category,
    components: score.components,
    weights: score.weights,
    engine_version: score.engineVersion,
  }, { onConflict: 'application_id' });

  await db.from('applications').update({
    screening_status: 'completed',
    stage: app.stage === 'submitted' ? 'ai_screening' : app.stage,
  }).eq('id', applicationId);

  await db.from('application_events').insert({
    application_id: applicationId, kind: 'screening_completed',
    from_stage: 'submitted', to_stage: 'ai_screening',
    note: `Screening complete. Deterministic score ${score.overall} (${score.category}).`,
  });

  const { data: jobRow } = await db.from('jobs').select('recruiter_id, title').eq('id', app.job_id).single();
  if (jobRow) {
    await notifyUser(jobRow.recruiter_id, {
      kind: 'screening_completed',
      title: 'Screening complete',
      body: `A new applicant for ${jobRow.title} scored ${score.overall.toFixed(0)}.`,
      link: `/recruiter/applications/${applicationId}`,
    });
  }
  await notify(app.candidate_id, 'candidate', {
    kind: 'application_screened',
    title: 'Your application was screened',
    body: 'Your assessment is complete and is now with the hiring team.',
    link: `/candidate/applications/${applicationId}`,
  });

  return { overall: score.overall, category: score.category };
}

export async function buildInterviewKit(applicationId: string, cfg?: Settings) {
  const c = cfg ?? await settings();
  const db = createAdminClient();
  const { data: app } = await db
    .from('applications').select('*, jobs(title), application_analyses(concerns)').eq('id', applicationId).single();
  if (!app) throw new AiError('unknown', 'Application not found.');

  const { data: reqs } = await db.from('job_requirements').select('label').eq('job_id', app.job_id);
  const analyses = app.application_analyses as unknown as { concerns: string[] } | null;

  const prompt = interviewKitPrompt({
    jobTitle: (app.jobs as unknown as { title: string }).title,
    requirements: (reqs ?? []).map((r) => r.label),
    resumeText: app.resume_text_snapshot,
    concerns: analyses?.concerns ?? [],
  });

  const { data, meta } = await structured({ ...prompt, schema: interviewKitSchema, model: c.model, maxTokens: 6000 });
  await recordUsage('interview_kit', meta.model, meta, true);

  await db.from('interview_kits').upsert({
    application_id: applicationId, questions: data.questions, model: meta.model,
  }, { onConflict: 'application_id' });

  return { questions: data.questions.length };
}

export async function buildInterviewPrep(candidateId: string, jobId: string, cfg?: Settings) {
  const c = cfg ?? await settings();
  const db = createAdminClient();
  const { data: resume } = await db
    .from('resumes').select('extracted_text').eq('candidate_id', candidateId).eq('is_active', true).maybeSingle();
  const { data: job } = await db.from('jobs').select('title').eq('id', jobId).single();
  const { data: reqs } = await db.from('job_requirements').select('label').eq('job_id', jobId);
  if (!resume?.extracted_text || !job) throw new AiError('refused', 'An active resume is required before generating preparation.');

  const prompt = interviewPrepPrompt({
    jobTitle: job.title,
    requirements: (reqs ?? []).map((r) => r.label),
    resumeText: resume.extracted_text,
  });
  const { data, meta } = await structured({ ...prompt, schema: interviewPrepSchema, model: c.model, maxTokens: 6000 });
  await recordUsage('interview_prep', meta.model, meta, true);

  await db.from('interview_preps').upsert({
    candidate_id: candidateId, job_id: jobId, questions: data.questions, model: meta.model,
  }, { onConflict: 'candidate_id,job_id' });

  return { questions: data.questions.length };
}

/* --- Synchronous helpers used directly by API routes --------------- */

export async function candidateMatchPreview(args: { jobTitle: string; requirements: string[]; resumeText: string }) {
  const c = await settings();
  const prompt = candidateMatchPrompt(args);
  const { data, meta } = await structured({ ...prompt, schema: candidateMatchSchema, model: c.model });
  await recordUsage('application_screening', meta.model, meta, true);
  return data;
}

export async function practiceFeedback(args: { question: string; answer: string; jobTitle: string }) {
  const c = await settings();
  const prompt = practiceFeedbackPrompt(args);
  const { data, meta } = await structured({ ...prompt, schema: practiceFeedbackSchema, model: c.model });
  await recordUsage('practice_feedback', meta.model, meta, true);
  return data;
}

export async function rewriteSection(args: { original: string; targetRole?: string | null }) {
  const c = await settings();
  const prompt = rewritePrompt(args);
  const { data, meta } = await structured({ ...prompt, schema: rewriteSchema, model: c.model });
  await recordUsage('rewrite', meta.model, meta, true);
  return data;
}

export async function compareCandidates(jobTitle: string, candidates: Array<{
  ref: string; matrix: Array<{ label: string; state: string }>; strengths: string[]; concerns: string[];
}>) {
  const c = await settings();
  const prompt = comparisonPrompt(candidates, jobTitle);
  const { data, meta } = await structured({ ...prompt, schema: comparisonSchema, model: c.model });
  await recordUsage('comparison', meta.model, meta, true);
  return data;
}

/* --- Notifications -------------------------------------------------- */

async function notify(candidateId: string, _role: 'candidate', n: { kind: string; title: string; body: string; link: string }) {
  const db = createAdminClient();
  const { data } = await db.from('candidate_profiles').select('user_id').eq('id', candidateId).single();
  if (data) await notifyUser(data.user_id, n);
}

export async function notifyUser(userId: string, n: { kind: string; title: string; body: string; link: string }) {
  const db = createAdminClient();
  await db.from('notifications').insert({
    user_id: userId, kind: n.kind, title: n.title, body: n.body, link: n.link,
  });
}
