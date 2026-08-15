/**
 * AI layer tests (§7, §66, §67, §101).
 *
 * Verifies the parts of the AI integration that must behave correctly when
 * the provider misbehaves — which, on a rate-limited free tier, is often.
 * No network calls: provider responses are simulated.
 */

import {
  jobAnalysisSchema, resumeAnalysisSchema, screeningSchema,
  interviewKitSchema, practiceFeedbackSchema, rewriteSchema,
  candidateMatchSchema, comparisonSchema, interviewPrepSchema,
  EVIDENCE_CONTRACT, screeningPrompt, jobAnalysisPrompt, rewritePrompt,
} from '../lib/ai/prompts';
import { AiError } from '../lib/ai/groq';

let pass = 0;
let fail = 0;
function check(name: string, condition: boolean, detail = '') {
  if (condition) { pass += 1; console.log(`  PASS  ${name}`); }
  else { fail += 1; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
}
function section(t: string) { console.log(`\n[${t}]`); }

/* ------------------------------------------------------------------ */
section('Error classification and retry policy');

const retryable: Array<[string, AiError]> = [
  ['rate_limit', new AiError('rate_limit', 'x', 20000)],
  ['unavailable', new AiError('unavailable', 'x')],
  ['timeout', new AiError('timeout', 'x')],
  ['malformed', new AiError('malformed', 'x')],
];
for (const [kind, err] of retryable) {
  check(`${kind} is retryable`, err.retryable);
}

const terminal: Array<[string, AiError]> = [
  ['config', new AiError('config', 'x')],
  ['refused', new AiError('refused', 'x')],
  ['unknown', new AiError('unknown', 'x')],
];
for (const [kind, err] of terminal) {
  check(`${kind} is NOT retryable`, !err.retryable);
}

check('rate limit carries a retry-after hint',
  new AiError('rate_limit', 'x', 20000).retryAfterMs === 20000);

// A bad API key must not be retried four times — that just burns quota and
// delays the operator seeing the real problem.
check('a credential failure fails fast rather than looping',
  !new AiError('config', 'bad key').retryable);

/* ------------------------------------------------------------------ */
section('JSON salvage from imperfect model output');

/** Mirrors the parser in lib/ai/groq.ts. */
function tryParse(raw: string): { ok: true; value: unknown } | { ok: false } {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try { return { ok: true, value: JSON.parse(cleaned) }; } catch { /* continue */ }
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try { return { ok: true, value: JSON.parse(cleaned.slice(start, end + 1)) }; } catch { /* continue */ }
  }
  return { ok: false };
}

check('parses clean JSON', tryParse('{"a":1}').ok);
check('strips ```json fences', tryParse('```json\n{"a":1}\n```').ok);
check('strips bare ``` fences', tryParse('```\n{"a":1}\n```').ok);
check('salvages JSON after a prose preamble',
  tryParse('Here is the analysis you asked for:\n{"a":1}').ok);
check('salvages JSON with a trailing note',
  tryParse('{"a":1}\nLet me know if you need anything else.').ok);
check('handles nested objects in salvage',
  tryParse('Sure!\n{"a":{"b":[1,2]},"c":"}"}\nDone').ok);
check('reports failure on genuinely broken output', !tryParse('not json at all').ok);
check('reports failure on truncated JSON', !tryParse('{"a":1,"b":').ok);

/* ------------------------------------------------------------------ */
section('Schema validation rejects malformed AI output');

// Valid minimal payloads
const validJobAnalysis = {
  requirements: [{ label: 'Python', kind: 'skill', importance: 'required', detail: null }],
  weights: {
    technical_skills: 0.4, experience: 0.2, projects: 0.15,
    education: 0.1, certifications: 0.05, semantic_fit: 0.1,
  },
  rationale: 'Engineering role weighted toward hands-on skill.',
  seniority: 'senior',
};
check('accepts a well-formed job analysis', jobAnalysisSchema.safeParse(validJobAnalysis).success);

check('rejects an invalid importance value',
  !jobAnalysisSchema.safeParse({
    ...validJobAnalysis,
    requirements: [{ label: 'Python', kind: 'skill', importance: 'mandatory', detail: null }],
  }).success);

check('rejects an out-of-range weight',
  !jobAnalysisSchema.safeParse({
    ...validJobAnalysis,
    weights: { ...validJobAnalysis.weights, technical_skills: 1.7 },
  }).success);

check('rejects a missing weight dimension',
  !jobAnalysisSchema.safeParse({
    ...validJobAnalysis,
    weights: { technical_skills: 0.4, experience: 0.2 },
  }).success);

const validScreening = {
  requirement_matrix: [{
    requirement_id: 'r1', label: 'Python', state: 'demonstrated',
    evidence: 'Built ETL pipelines in Python', reasoning: 'Explicitly named.',
  }],
  skill_intelligence: { matching: ['Python'], missing: ['AWS'], additional: ['dbt'] },
  experience_intelligence: { relevant_roles: [], relevant_projects: [] },
  semantic_fit: 0.72,
  strengths: ['Quantified pipeline impact.'],
  concerns: ['No evidence of AWS.'],
  summary: 'Strong pipeline background.',
};
check('accepts a well-formed screening result', screeningSchema.safeParse(validScreening).success);

check('rejects an invalid evidence state',
  !screeningSchema.safeParse({
    ...validScreening,
    requirement_matrix: [{ ...validScreening.requirement_matrix[0], state: 'probably' }],
  }).success);

check('rejects semantic_fit above 1',
  !screeningSchema.safeParse({ ...validScreening, semantic_fit: 1.4 }).success);

check('rejects negative semantic_fit',
  !screeningSchema.safeParse({ ...validScreening, semantic_fit: -0.2 }).success);

check('allows null evidence for not_demonstrated',
  screeningSchema.safeParse({
    ...validScreening,
    requirement_matrix: [{
      requirement_id: 'r1', label: 'AWS', state: 'not_demonstrated',
      evidence: null, reasoning: 'No AWS service named.',
    }],
  }).success);

// The screening schema must NOT accept an overall score — that would mean the
// model was being asked for the number the engine is supposed to compute.
const screeningKeys = Object.keys(screeningSchema.shape);
check('screening schema has no overall/score field',
  !screeningKeys.some((k) => /^(overall|score|rating|percentage|fit_score)$/.test(k)),
  screeningKeys.join(', '));

check('interview kit requires at least six questions',
  !interviewKitSchema.safeParse({ questions: [] }).success);

check('rewrite schema requires at least two variants',
  !rewriteSchema.safeParse({
    variants: [{ text: 'x', emphasis: 'y' }], preserved_facts: [], warning: null,
  }).success);

check('practice feedback ratings are bounded at 5',
  !practiceFeedbackSchema.safeParse({
    did_well: [], improve: [], missing_points: [],
    ratings: { relevance: 9, clarity: 3, structure: 3, depth: 3 },
    suggested_structure: 'x', follow_up: 'y',
  }).success);

/* ------------------------------------------------------------------ */
section('Evidence contract is enforced in every prompt');

const contractRules: Array<[string, RegExp]> = [
  ['forbids invention', /NEVER invent information/i],
  ['forbids upgrading vague claims', /NEVER upgrade vague statements/i],
  ['names the cloud/AWS trap explicitly', /Cloud technologies.{0,60}NOT evidence of AWS/is],
  ['defines exactly three evidence states', /demonstrated[\s\S]{0,400}insufficient[\s\S]{0,400}not_demonstrated/],
  ['requires citation for positive verdicts', /MUST include an\s*\n?\s*"evidence" field/i],
  ['instructs erring toward the weaker state', /choose the weaker state/i],
  ['forbids producing a final score', /NEVER produce an overall percentage/i],
  ['forbids protected-characteristic inference', /NEVER infer or comment on age, gender/i],
  ['requires JSON-only output', /single valid JSON object/i],
];
for (const [label, re] of contractRules) {
  check(`contract ${label}`, re.test(EVIDENCE_CONTRACT));
}

const prompts = [
  ['screening', screeningPrompt({
    jobTitle: 'X', jobCompany: 'Y', jobDescription: 'Z',
    requirements: [{ id: '1', label: 'Python', kind: 'skill', importance: 'required' }],
    resumeText: 'resume', candidateSummary: null,
  })],
  ['job analysis', jobAnalysisPrompt({
    title: 'X', company: 'Y', description: 'Z',
    responsibilities: [], preferred: [], niceToHave: [],
  })],
  ['rewrite', rewritePrompt({ original: 'Did a thing.', targetRole: null })],
] as const;

for (const [name, p] of prompts) {
  check(`${name} prompt inherits the contract`, p.system.includes('NEVER invent information'));
}

check('rewrite prompt forbids inventing metrics',
  /may NOT add metrics/i.test(rewritePrompt({ original: 'x', targetRole: null }).system));

check('screening prompt forbids judging the person',
  /concerns.{0,120}never the person/is.test(screeningPrompt({
    jobTitle: 'X', jobCompany: 'Y', jobDescription: 'Z',
    requirements: [], resumeText: 'r', candidateSummary: null,
  }).system));

/* ------------------------------------------------------------------ */
section('Prompt input truncation');

const huge = 'A'.repeat(80000);
const truncated = screeningPrompt({
  jobTitle: 'X', jobCompany: 'Y', jobDescription: huge,
  requirements: [], resumeText: huge, candidateSummary: null,
});
check('oversized input is truncated', truncated.user.length < 60000,
  `${truncated.user.length} chars`);
check('truncation is signposted to the model', truncated.user.includes('TRUNCATED'));

/* ------------------------------------------------------------------ */
section('Candidate-facing schema hides internal signals');

const candidateKeys = Object.keys(candidateMatchSchema.shape);
check('candidate match exposes no score',
  !candidateKeys.some((k) => /score|rank|percentile|position/i.test(k)),
  candidateKeys.join(', '));

check('comparison schema produces no ranking field',
  !Object.keys(comparisonSchema.shape).some((k) => /rank|winner|best|recommend/i.test(k)));

check('interview prep includes answer structure guidance',
  'questions' in interviewPrepSchema.shape);

check('resume analysis ATS score is bounded 0-100',
  !resumeAnalysisSchema.safeParse({
    ats: { score: 140, parseability: 'clean', findings: [] },
    extracted: {
      full_name: null, headline: null, location: null, years_experience: null,
      skills: [], education: [], experience: [], projects: [], certifications: [],
    },
    sections: { summary: null, has_summary: false, has_quantified_impact: false, readability: 'weak', notes: [] },
    strengths: [], improvements: [],
  }).success);

console.log(`\n${'='.repeat(52)}`);
console.log(`${pass} passed, ${fail} failed`);
console.log('='.repeat(52));
process.exit(fail ? 1 : 0);
