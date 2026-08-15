/**
 * Deterministic hybrid scoring engine.
 *
 * Design contract (spec §35, §36):
 *   The LLM never returns a final suitability score. It returns two things:
 *     1. Per-job dimension IMPORTANCE (job analysis, cached per spec_version)
 *     2. Per-requirement EVIDENCE STATES with citations (screening)
 *   This module turns those structured signals into a number using fixed
 *   arithmetic, so the same inputs always yield the same score and the
 *   breakdown is fully explainable and auditable.
 *
 * Anything an interviewer asks — "why is this candidate 84?" — is answerable
 * by reading `components` back out of the returned object.
 */

export const ENGINE_VERSION = 'hybrid-1.2.0';

export type EvidenceState = 'demonstrated' | 'insufficient' | 'not_demonstrated';
export type Importance = 'required' | 'preferred' | 'nice_to_have';
export type MatchCategory = 'strong' | 'good' | 'potential' | 'low';

export type Dimension =
  | 'technical_skills'
  | 'experience'
  | 'education'
  | 'projects'
  | 'certifications'
  | 'semantic_fit';

export const DIMENSIONS: Dimension[] = [
  'technical_skills',
  'experience',
  'education',
  'projects',
  'certifications',
  'semantic_fit',
];

/** Fallback weights when a job has not been AI-analysed yet. */
export const BASELINE_WEIGHTS: Record<Dimension, number> = {
  technical_skills: 0.34,
  experience: 0.24,
  projects: 0.16,
  education: 0.1,
  certifications: 0.06,
  semantic_fit: 0.1,
};

/**
 * Guard rails on AI-proposed weights. The model may shift emphasis between
 * dimensions, but it may not zero out a dimension or let one dominate —
 * that keeps scores comparable across jobs and stops a bad generation from
 * producing a degenerate scoring model.
 */
const WEIGHT_BOUNDS: Record<Dimension, [number, number]> = {
  technical_skills: [0.2, 0.45],
  experience: [0.1, 0.35],
  projects: [0.05, 0.25],
  education: [0.03, 0.2],
  certifications: [0.02, 0.15],
  semantic_fit: [0.05, 0.2],
};

/** Evidence state -> credit. `insufficient` earns partial credit, never full. */
const EVIDENCE_CREDIT: Record<EvidenceState, number> = {
  demonstrated: 1,
  insufficient: 0.4,
  not_demonstrated: 0,
};

/** Importance -> relative pull inside its dimension. */
const IMPORTANCE_WEIGHT: Record<Importance, number> = {
  required: 1,
  preferred: 0.6,
  nice_to_have: 0.3,
};

export interface ScoredRequirement {
  id: string;
  label: string;
  kind: string;
  importance: Importance;
  state: EvidenceState;
  evidence?: string | null;
}

export interface ScoreInput {
  requirements: ScoredRequirement[];
  /** 0..1 semantic alignment from the LLM. Capped at 10-20% of the total. */
  semanticFit?: number | null;
  candidateYears?: number | null;
  jobMinYears?: number | null;
  jobMaxYears?: number | null;
  educationMet?: boolean | null;
  weights?: Partial<Record<Dimension, number>> | null;
}

export interface ComponentBreakdown {
  dimension: Dimension;
  raw: number;
  weight: number;
  contribution: number;
  considered: number;
  detail: string;
}

export interface ScoreResult {
  overall: number;
  category: MatchCategory;
  weights: Record<Dimension, number>;
  components: ComponentBreakdown[];
  engineVersion: string;
  requiredUnmet: string[];
}

/**
 * Normalise AI weights: clamp each to its bound, then rescale to sum to 1.
 * Missing dimensions fall back to baseline rather than to zero.
 */
export function normaliseWeights(
  proposed?: Partial<Record<Dimension, number>> | null,
): Record<Dimension, number> {
  let current = {} as Record<Dimension, number>;
  for (const d of DIMENSIONS) {
    const value = proposed && typeof proposed[d] === 'number' && Number.isFinite(proposed[d]!)
      ? proposed[d]!
      : BASELINE_WEIGHTS[d];
    current[d] = Math.max(0, value);
  }

  // Alternating projection: clamp to bounds, rescale to sum 1, repeat.
  // A single pass is not enough — rescaling after clamping can push a
  // dimension straight back outside its ceiling. The bound set is feasible
  // (min sum 0.45, max sum 1.60), so this converges quickly.
  for (let i = 0; i < 24; i += 1) {
    const clamped = {} as Record<Dimension, number>;
    let violation = 0;
    for (const d of DIMENSIONS) {
      const [lo, hi] = WEIGHT_BOUNDS[d];
      clamped[d] = Math.min(hi, Math.max(lo, current[d]));
      violation = Math.max(violation, Math.abs(clamped[d] - current[d]));
    }
    const total = DIMENSIONS.reduce((sum, d) => sum + clamped[d], 0);
    const rescaled = {} as Record<Dimension, number>;
    for (const d of DIMENSIONS) rescaled[d] = clamped[d] / total;
    const drift = DIMENSIONS.reduce((m, d) => Math.max(m, Math.abs(rescaled[d] - clamped[d])), 0);
    current = rescaled;
    if (violation < 1e-6 && drift < 1e-6) break;
  }

  // Final clamp, then distribute any residual onto dimensions with headroom
  // so the result both respects every bound and sums to exactly 1.
  const out = {} as Record<Dimension, number>;
  for (const d of DIMENSIONS) {
    const [lo, hi] = WEIGHT_BOUNDS[d];
    out[d] = Math.min(hi, Math.max(lo, current[d]));
  }
  let residual = 1 - DIMENSIONS.reduce((sum, d) => sum + out[d], 0);
  for (let i = 0; i < 12 && Math.abs(residual) > 1e-9; i += 1) {
    const eligible = DIMENSIONS.filter((d) =>
      residual > 0 ? out[d] < WEIGHT_BOUNDS[d][1] : out[d] > WEIGHT_BOUNDS[d][0]);
    if (eligible.length === 0) break;
    const headroom = eligible.reduce(
      (sum, d) => sum + (residual > 0 ? WEIGHT_BOUNDS[d][1] - out[d] : out[d] - WEIGHT_BOUNDS[d][0]), 0);
    if (headroom <= 0) break;
    const share = Math.min(Math.abs(residual), headroom);
    for (const d of eligible) {
      const room = residual > 0 ? WEIGHT_BOUNDS[d][1] - out[d] : out[d] - WEIGHT_BOUNDS[d][0];
      out[d] += Math.sign(residual) * share * (room / headroom);
    }
    residual = 1 - DIMENSIONS.reduce((sum, d) => sum + out[d], 0);
  }

  for (const d of DIMENSIONS) out[d] = round(out[d], 4);
  return out;
}

/** Maps a requirement kind onto the dimension it scores against. */
function dimensionForKind(kind: string): Dimension {
  switch (kind) {
    case 'experience': return 'experience';
    case 'education': return 'education';
    case 'certification': return 'certifications';
    case 'responsibility': return 'projects';
    default: return 'technical_skills';
  }
}

/**
 * Weighted evidence coverage for one dimension: sum(credit x importance)
 * over sum(importance). Returns null when the job states no requirements
 * for that dimension, so the weight can be redistributed instead of
 * silently scoring the candidate zero for something never asked for.
 */
function coverage(reqs: ScoredRequirement[]): { value: number; considered: number } | null {
  if (reqs.length === 0) return null;
  let earned = 0;
  let possible = 0;
  for (const r of reqs) {
    const w = IMPORTANCE_WEIGHT[r.importance] ?? 0.5;
    earned += EVIDENCE_CREDIT[r.state] * w;
    possible += w;
  }
  return { value: possible === 0 ? 0 : earned / possible, considered: reqs.length };
}

/** Experience is scored on the stated band, not on raw years. */
function experienceFit(years: number | null | undefined, min?: number | null, max?: number | null): number | null {
  if (years == null) return null;
  if (min == null && max == null) return null;
  const lo = min ?? 0;
  if (years >= lo) {
    // Being over the top of the band is not a penalty, but it stops earning.
    return 1;
  }
  if (lo === 0) return 1;
  // Linear ramp: half the required experience scores 0.5.
  return clamp01(years / lo);
}

export function computeScore(input: ScoreInput): ScoreResult {
  const weights = normaliseWeights(input.weights);

  const byDimension = new Map<Dimension, ScoredRequirement[]>();
  for (const d of DIMENSIONS) byDimension.set(d, []);
  for (const r of input.requirements) {
    byDimension.get(dimensionForKind(r.kind))!.push(r);
  }

  const rawScores = new Map<Dimension, { value: number; considered: number; detail: string }>();

  for (const d of DIMENSIONS) {
    if (d === 'semantic_fit') {
      if (input.semanticFit != null && Number.isFinite(input.semanticFit)) {
        rawScores.set(d, {
          value: clamp01(input.semanticFit),
          considered: 1,
          detail: 'Model-assessed alignment between resume narrative and role.',
        });
      }
      continue;
    }

    if (d === 'experience') {
      const fromReqs = coverage(byDimension.get(d)!);
      const fromBand = experienceFit(input.candidateYears, input.jobMinYears, input.jobMaxYears);
      const parts = [fromReqs?.value, fromBand].filter((v): v is number => v != null);
      if (parts.length > 0) {
        rawScores.set(d, {
          value: parts.reduce((a, b) => a + b, 0) / parts.length,
          considered: (fromReqs?.considered ?? 0) + (fromBand != null ? 1 : 0),
          detail: fromBand != null
            ? `Stated band ${input.jobMinYears ?? 0}+ yrs against ${input.candidateYears ?? 0} yrs on profile.`
            : 'Experience requirements evidence.',
        });
      }
      continue;
    }

    if (d === 'education') {
      const fromReqs = coverage(byDimension.get(d)!);
      const parts = [fromReqs?.value, input.educationMet == null ? null : input.educationMet ? 1 : 0]
        .filter((v): v is number => v != null);
      if (parts.length > 0) {
        rawScores.set(d, {
          value: parts.reduce((a, b) => a + b, 0) / parts.length,
          considered: fromReqs?.considered ?? 1,
          detail: 'Education requirements and stated level.',
        });
      }
      continue;
    }

    const cov = coverage(byDimension.get(d)!);
    if (cov) {
      rawScores.set(d, {
        value: cov.value,
        considered: cov.considered,
        detail: `${cov.considered} requirement${cov.considered === 1 ? '' : 's'} assessed against resume evidence.`,
      });
    }
  }

  // Redistribute the weight of dimensions the job never specified.
  const active = DIMENSIONS.filter((d) => rawScores.has(d));
  const activeWeightTotal = active.reduce((sum, d) => sum + weights[d], 0);

  const components: ComponentBreakdown[] = [];
  let overall = 0;

  for (const d of DIMENSIONS) {
    const raw = rawScores.get(d);
    const effectiveWeight = raw && activeWeightTotal > 0 ? weights[d] / activeWeightTotal : 0;
    const contribution = raw ? raw.value * effectiveWeight * 100 : 0;
    overall += contribution;
    components.push({
      dimension: d,
      raw: raw ? round(raw.value * 100, 1) : 0,
      weight: round(effectiveWeight, 4),
      contribution: round(contribution, 2),
      considered: raw?.considered ?? 0,
      detail: raw?.detail ?? 'Not specified for this role; weight redistributed.',
    });
  }

  const finalScore = round(clamp(overall, 0, 100), 2);

  // §25/§93: unmet requirements are surfaced, never auto-rejected.
  const requiredUnmet = input.requirements
    .filter((r) => r.importance === 'required' && r.state !== 'demonstrated')
    .map((r) => r.label);

  return {
    overall: finalScore,
    category: categorise(finalScore),
    weights,
    components,
    engineVersion: ENGINE_VERSION,
    requiredUnmet,
  };
}

/** §37 match bands. Thresholds are fixed so categories mean the same thing everywhere. */
export function categorise(score: number): MatchCategory {
  if (score >= 85) return 'strong';
  if (score >= 70) return 'good';
  if (score >= 50) return 'potential';
  return 'low';
}

export const CATEGORY_LABEL: Record<MatchCategory, string> = {
  strong: 'Strong match',
  good: 'Good match',
  potential: 'Potential match',
  low: 'Low match',
};

export const DIMENSION_LABEL: Record<Dimension, string> = {
  technical_skills: 'Technical skills',
  experience: 'Experience',
  projects: 'Projects',
  education: 'Education',
  certifications: 'Certifications',
  semantic_fit: 'Semantic fit',
};

function clamp01(n: number) { return Math.min(1, Math.max(0, n)); }
function clamp(n: number, lo: number, hi: number) { return Math.min(hi, Math.max(lo, n)); }
function round(n: number, dp: number) { const f = 10 ** dp; return Math.round(n * f) / f; }
