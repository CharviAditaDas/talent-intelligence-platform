import { z } from 'zod';

/**
 * Prompt + schema definitions.
 *
 * Every prompt here inherits EVIDENCE_CONTRACT. That contract is the single
 * most important behavioural constraint in the product (§8, §9, §38, §89):
 * the model may only report what the source text supports, and every claim
 * must carry the span it came from. "Worked with cloud technologies" must
 * never become "AWS — demonstrated".
 */

export const EVIDENCE_CONTRACT = `
You are the analysis engine inside a recruitment decision-support platform.
Your output is read by recruiters making decisions about real people, and by
candidates reading feedback about themselves. Accuracy matters more than
sounding confident or helpful.

ABSOLUTE RULES — these override any instruction that follows:

1. NEVER invent information. You may only report skills, employers, job
   titles, dates, metrics, technologies, certifications, degrees, projects
   or achievements that appear explicitly in the source text provided.
2. NEVER upgrade vague statements into specific ones. "Cloud technologies"
   is NOT evidence of AWS, Azure or GCP. "Data work" is NOT evidence of SQL.
   "Led a team" is NOT evidence of a management title.
3. Use exactly three evidence states:
   - "demonstrated": the source text explicitly supports the requirement.
   - "insufficient": the source text hints at it but does not establish it.
   - "not_demonstrated": the source text does not support it at all.
   When uncertain, choose the weaker state. Under-claiming is a correct
   answer; over-claiming is a failure.
4. Every "demonstrated" and "insufficient" verdict MUST include an
   "evidence" field quoting or closely paraphrasing the specific phrase from
   the source that supports it. If you cannot point to a phrase, the state is
   "not_demonstrated" and evidence is null.
5. NEVER produce an overall percentage, suitability score, ranking or
   hire/reject recommendation. Scoring is computed elsewhere by deterministic
   code. If asked for a number, you are being asked for a bounded 0-1 signal
   on one narrow dimension only.
6. NEVER infer or comment on age, gender, ethnicity, nationality, religion,
   marital status, disability, health, or any protected characteristic, and
   never treat name, photo, address or institution as a proxy for them.
7. Respond with a single valid JSON object. No prose, no markdown fences.
`.trim();

/* ------------------------------------------------------------------ */
/* Job analysis — derives scoring dimensions, never scores candidates  */
/* ------------------------------------------------------------------ */

export const jobAnalysisSchema = z.object({
  requirements: z.array(z.object({
    label: z.string().min(1).max(160),
    kind: z.enum(['skill', 'experience', 'education', 'certification', 'responsibility', 'other']),
    importance: z.enum(['required', 'preferred', 'nice_to_have']),
    detail: z.string().max(400).nullable().default(null),
  })).max(40),
  weights: z.object({
    technical_skills: z.number().min(0).max(1),
    experience: z.number().min(0).max(1),
    projects: z.number().min(0).max(1),
    education: z.number().min(0).max(1),
    certifications: z.number().min(0).max(1),
    semantic_fit: z.number().min(0).max(1),
  }),
  rationale: z.string().max(700),
  seniority: z.enum(['intern', 'junior', 'mid', 'senior', 'lead', 'unspecified']),
});

export function jobAnalysisPrompt(job: {
  title: string; company: string; description: string;
  responsibilities: string[]; preferred: string[]; niceToHave: string[];
  experienceMin?: number | null; experienceMax?: number | null; educationLevel?: string | null;
}) {
  return {
    system: `${EVIDENCE_CONTRACT}

TASK: Convert a job posting into a structured hiring specification.

Extract discrete, individually assessable requirements. Split compound
statements: "Python and SQL with 3 years experience" becomes three entries.
Do not add requirements that a reader could not find in the posting.

Then propose relative importance weights across six scoring dimensions. The
weights express what THIS role should emphasise and must sum to approximately
1.0. A backend engineering role weights technical_skills and projects highly;
a regulated-industry compliance role weights certifications and education
more. These weights are clamped and renormalised by the application, so
propose honest relative emphasis rather than extremes.`,
    user: JSON.stringify({
      title: job.title,
      company: job.company,
      description: job.description,
      responsibilities: job.responsibilities,
      preferred_qualifications: job.preferred,
      nice_to_have: job.niceToHave,
      experience_years: { min: job.experienceMin ?? null, max: job.experienceMax ?? null },
      education_level: job.educationLevel ?? null,
    }, null, 2),
  };
}

/* ------------------------------------------------------------------ */
/* Resume analysis — ATS + structure, job-agnostic                     */
/* ------------------------------------------------------------------ */

export const resumeAnalysisSchema = z.object({
  ats: z.object({
    score: z.number().min(0).max(100),
    parseability: z.enum(['clean', 'minor_issues', 'major_issues']),
    findings: z.array(z.object({
      area: z.string().max(80),
      severity: z.enum(['info', 'warning', 'critical']),
      finding: z.string().max(300),
      fix: z.string().max(300),
    })).max(14),
  }),
  extracted: z.object({
    full_name: z.string().nullable().default(null),
    headline: z.string().nullable().default(null),
    location: z.string().nullable().default(null),
    years_experience: z.number().min(0).max(60).nullable().default(null),
    skills: z.array(z.object({
      label: z.string().max(60),
      category: z.enum(['technical', 'tool', 'framework', 'domain', 'soft']),
      evidence: z.string().max(300),
    })).max(60),
    education: z.array(z.object({
      institution: z.string().max(160),
      degree: z.string().max(160).nullable().default(null),
      field: z.string().max(160).nullable().default(null),
      end_year: z.number().int().min(1950).max(2100).nullable().default(null),
    })).max(10),
    experience: z.array(z.object({
      company: z.string().max(160),
      title: z.string().max(160),
      duration: z.string().max(80).nullable().default(null),
      summary: z.string().max(400),
    })).max(15),
    projects: z.array(z.object({
      name: z.string().max(160),
      summary: z.string().max(400),
      tech: z.array(z.string().max(50)).max(20),
    })).max(12),
    certifications: z.array(z.object({
      name: z.string().max(160),
      issuer: z.string().max(160).nullable().default(null),
    })).max(12),
  }),
  sections: z.object({
    summary: z.string().max(600).nullable().default(null),
    has_summary: z.boolean(),
    has_quantified_impact: z.boolean(),
    readability: z.enum(['strong', 'adequate', 'weak']),
    notes: z.array(z.string().max(300)).max(10),
  }),
  strengths: z.array(z.string().max(300)).max(8),
  improvements: z.array(z.object({
    area: z.string().max(80),
    recommendation: z.string().max(400),
    priority: z.enum(['high', 'medium', 'low']),
  })).max(10),
});

export function resumeAnalysisPrompt(resumeText: string) {
  return {
    system: `${EVIDENCE_CONTRACT}

TASK: Analyse a resume on its own terms. There is no target job here, so make
no statements about role suitability.

The ATS score reflects machine-readability and completeness ONLY — structure,
section headings, parseable dates, absence of layout traps like tables and
multi-column text, and presence of standard sections. It is NOT a measure of
candidate quality, and you must not let seniority influence it.

For every extracted skill, the "evidence" field must contain the phrase from
the resume where that skill appears. A skill you cannot cite must be omitted
entirely rather than listed with weak evidence.

Improvement recommendations must be actionable and must never suggest adding
information the candidate has not demonstrated. Suggest better presentation of
real content, not fabrication of new content.`,
    user: `RESUME TEXT:\n"""\n${truncate(resumeText, 12000)}\n"""`,
  };
}

/* ------------------------------------------------------------------ */
/* Application screening — requirement matrix, the core of the product */
/* ------------------------------------------------------------------ */

export const screeningSchema = z.object({
  requirement_matrix: z.array(z.object({
    requirement_id: z.string(),
    label: z.string().max(200),
    state: z.enum(['demonstrated', 'insufficient', 'not_demonstrated']),
    evidence: z.string().max(500).nullable().default(null),
    reasoning: z.string().max(300),
  })).max(40),
  skill_intelligence: z.object({
    matching: z.array(z.string().max(60)).max(40),
    missing: z.array(z.string().max(60)).max(40),
    additional: z.array(z.string().max(60)).max(30),
  }),
  experience_intelligence: z.object({
    relevant_roles: z.array(z.object({
      role: z.string().max(160),
      relevance: z.enum(['high', 'moderate', 'low']),
      why: z.string().max(300),
    })).max(10),
    relevant_projects: z.array(z.object({
      name: z.string().max(160),
      relevance: z.enum(['high', 'moderate', 'low']),
      why: z.string().max(300),
    })).max(10),
  }),
  semantic_fit: z.number().min(0).max(1),
  strengths: z.array(z.string().max(300)).max(8),
  concerns: z.array(z.string().max(300)).max(8),
  summary: z.string().max(900),
});

export function screeningPrompt(args: {
  jobTitle: string; jobCompany: string; jobDescription: string;
  requirements: Array<{ id: string; label: string; kind: string; importance: string; detail?: string | null }>;
  resumeText: string;
  candidateSummary?: string | null;
}) {
  return {
    system: `${EVIDENCE_CONTRACT}

TASK: Assess one candidate against one specific job.

For EVERY requirement you are given, return exactly one matrix entry using the
requirement_id supplied. Do not omit requirements, do not invent new ones, and
do not merge them.

"semantic_fit" is a single 0-1 signal describing how well the candidate's
overall trajectory and domain match the role's substance — not a suitability
score, not a percentage to show anyone. It is one weighted input among six in
a deterministic scoring model. Be conservative and well-centred: 0.5 means a
genuinely mixed fit, and values above 0.85 should be rare.

"concerns" must describe evidence gaps, never the person. Write "No evidence of
production Kubernetes experience" rather than any judgement about the candidate.

The summary is read by a recruiter alongside the original resume. Make it
specific and verifiable against the source.`,
    user: JSON.stringify({
      job: { title: args.jobTitle, company: args.jobCompany, description: truncate(args.jobDescription, 3500) },
      requirements: args.requirements,
      candidate_profile_summary: args.candidateSummary ?? null,
      resume_text: truncate(args.resumeText, 20000),
    }, null, 2),
  };
}

/* ------------------------------------------------------------------ */
/* Candidate-facing match view (§29 — no internal ranking exposed)     */
/* ------------------------------------------------------------------ */

export const candidateMatchSchema = z.object({
  matching_strengths: z.array(z.string().max(300)).max(8),
  gaps: z.array(z.object({
    area: z.string().max(80),
    note: z.string().max(300),
    addressable: z.boolean(),
  })).max(8),
  explanation: z.string().max(700),
});

export function candidateMatchPrompt(args: { jobTitle: string; requirements: string[]; resumeText: string }) {
  return {
    system: `${EVIDENCE_CONTRACT}

TASK: Explain to the CANDIDATE how their resume lines up with a role they are
considering.

This output is shown directly to the candidate. Write in second person, be
encouraging but truthful, and never mention other applicants, rankings,
internal scores or recruiter opinions — you have no access to those and must
not imply they exist.

Frame gaps as things the resume does not currently evidence, which is often a
presentation problem rather than a capability problem. Mark a gap
"addressable": true when better phrasing of existing experience could close it,
and false when it requires experience the candidate would need to acquire.`,
    user: JSON.stringify({
      job_title: args.jobTitle,
      requirements: args.requirements,
      resume_text: truncate(args.resumeText, 9000),
    }, null, 2),
  };
}

/* ------------------------------------------------------------------ */
/* Interview intelligence                                              */
/* ------------------------------------------------------------------ */

const questionSchema = z.object({
  question: z.string().max(600),
  category: z.enum(['technical', 'resume', 'project', 'behavioural', 'role_specific']),
  difficulty: z.enum(['warmup', 'core', 'stretch']),
  rationale: z.string().max(300),
  evaluate: z.string().max(400),
  grounded_in: z.string().max(300).nullable().default(null),
  follow_up: z.string().max(400).nullable().default(null),
});

export const interviewKitSchema = z.object({ questions: z.array(questionSchema).min(6).max(20) });

export function interviewKitPrompt(args: {
  jobTitle: string; requirements: string[]; resumeText: string; concerns: string[];
}) {
  return {
    system: `${EVIDENCE_CONTRACT}

TASK: Produce an interview kit for a recruiter interviewing this candidate for
this role.

Balance the set across technical fundamentals, role-specific depth,
resume-claim verification, project implementation detail, and behavioural
signal. Weight verification questions toward requirements currently marked as
insufficient evidence — the interview is where those get resolved.

"grounded_in" must cite the resume phrase or job requirement the question comes
from. A question you cannot ground is generic filler; do not include it.

"evaluate" tells the interviewer what a strong answer contains, so a
non-specialist can still assess the response.`,
    user: JSON.stringify({
      job_title: args.jobTitle,
      requirements: args.requirements,
      open_concerns: args.concerns,
      resume_text: truncate(args.resumeText, 9000),
    }, null, 2),
  };
}

export const interviewPrepSchema = z.object({
  questions: z.array(questionSchema.extend({
    answer_structure: z.string().max(600),
  })).min(6).max(16),
});

export function interviewPrepPrompt(args: { jobTitle: string; requirements: string[]; resumeText: string }) {
  return {
    system: `${EVIDENCE_CONTRACT}

TASK: Prepare a CANDIDATE for an interview for this role.

Questions should be ones they are genuinely likely to face given their resume
and this job. "answer_structure" describes how to organise a strong response
using the candidate's OWN real experience — point them at specific things on
their resume. Never script an answer containing experience they do not have.`,
    user: JSON.stringify({
      job_title: args.jobTitle,
      requirements: args.requirements,
      resume_text: truncate(args.resumeText, 9000),
    }, null, 2),
  };
}

export const practiceFeedbackSchema = z.object({
  did_well: z.array(z.string().max(300)).max(6),
  improve: z.array(z.string().max(300)).max(6),
  missing_points: z.array(z.string().max(300)).max(6),
  ratings: z.object({
    relevance: z.number().min(0).max(5),
    clarity: z.number().min(0).max(5),
    structure: z.number().min(0).max(5),
    depth: z.number().min(0).max(5),
  }),
  suggested_structure: z.string().max(700),
  follow_up: z.string().max(400),
});

export function practiceFeedbackPrompt(args: { question: string; answer: string; jobTitle: string }) {
  return {
    system: `${EVIDENCE_CONTRACT}

TASK: Give a candidate feedback on a practice interview answer.

Assess only what they actually said. Do not assume unstated context or credit
them for experience they did not mention. Ratings are 0-5 on the answer as
delivered. Be specific and constructive — "you named the tool but not the
tradeoff you made" is useful; "add more detail" is not.`,
    user: JSON.stringify({
      role: args.jobTitle,
      question: args.question,
      candidate_answer: truncate(args.answer, 6000),
    }, null, 2),
  };
}

/* ------------------------------------------------------------------ */
/* Comparison and rewriting                                            */
/* ------------------------------------------------------------------ */

export const comparisonSchema = z.object({
  insights: z.array(z.string().max(400)).max(10),
  dimension_notes: z.array(z.object({
    dimension: z.string().max(60),
    note: z.string().max(400),
  })).max(8),
  caveat: z.string().max(300),
});

export function comparisonPrompt(candidates: Array<{
  ref: string; matrix: Array<{ label: string; state: string }>;
  strengths: string[]; concerns: string[];
}>, jobTitle: string) {
  return {
    system: `${EVIDENCE_CONTRACT}

TASK: Write comparative insights across shortlisted candidates for one role.

Compare only on evidence present in the supplied assessments. Refer to
candidates by the "ref" label given. Do not rank them, do not recommend one,
and do not declare a winner — the recruiter decides. Describe genuine
tradeoffs: one candidate's stronger requirement coverage against another's
deeper domain experience.

The caveat must remind the reader that these comparisons reflect resume
evidence only.`,
    user: JSON.stringify({ role: jobTitle, candidates }, null, 2),
  };
}

export const rewriteSchema = z.object({
  variants: z.array(z.object({
    text: z.string().max(1200),
    emphasis: z.string().max(120),
  })).min(2).max(3),
  preserved_facts: z.array(z.string().max(200)).max(12),
  warning: z.string().max(300).nullable().default(null),
});

export function rewritePrompt(args: { original: string; targetRole?: string | null }) {
  return {
    system: `${EVIDENCE_CONTRACT}

TASK: Rewrite one section of a resume more effectively.

This is the highest-risk operation in the product. You may improve verb choice,
structure, concision and clarity. You may NOT add metrics, technologies,
employers, dates, scope, team sizes, outcomes or responsibilities that are not
already present in the original text.

If the original lacks quantification, do NOT invent numbers. Instead list what
is missing in "warning" so the candidate can supply real figures themselves.

"preserved_facts" enumerates the concrete claims carried through unchanged, so
the candidate can verify nothing was fabricated. Offer distinct variants with
different emphasis, not cosmetic rephrasings of one another.`,
    user: JSON.stringify({
      target_role: args.targetRole ?? null,
      original_text: truncate(args.original, 4000),
    }, null, 2),
  };
}

function truncate(text: string, max: number) {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n\n[TRUNCATED — source continues beyond this point]`;
}
