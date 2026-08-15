'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CategoryPill, EmptyState } from '@/components/ui';
import { STAGE_LABEL } from '@/components/stage-tracker';
import type { MatchCategory } from '@/lib/scoring/engine';

export interface Row {
  id: string; name: string; email: string; location: string; years: number | null;
  score: number | null; category: MatchCategory | null; stage: string;
  screeningStatus: string; submittedAt: string;
  matchingSkills: string[]; missingSkills: string[]; requiredUnmet: number;
}

const STAGES = [
  'submitted', 'ai_screening', 'under_review', 'shortlisted',
  'interview_1', 'interview_2', 'final_evaluation', 'offer', 'hired', 'rejected',
] as const;

type SortKey = 'score' | 'name' | 'submitted' | 'experience';

/**
 * Ranked applicant table with multi-filter search (§48, §49).
 * Filtering happens client-side over rows RLS already scoped to this job,
 * so no candidate outside this role's applicants is ever in memory.
 */
export function RankingTable({ rows, jobId }: { rows: Row[]; jobId: string }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [skill, setSkill] = useState('');
  const [missing, setMissing] = useState('');
  const [category, setCategory] = useState<string>('');
  const [stage, setStage] = useState<string>('');
  const [minYears, setMinYears] = useState('');
  const [maxYears, setMaxYears] = useState('');
  const [sort, setSort] = useState<SortKey>('score');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [comparing, setComparing] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sk = skill.trim().toLowerCase();
    const ms = missing.trim().toLowerCase();
    const lo = minYears === '' ? null : Number(minYears);
    const hi = maxYears === '' ? null : Number(maxYears);

    const out = rows.filter((r) => {
      if (q && !(`${r.name} ${r.email} ${r.location}`.toLowerCase().includes(q))) return false;
      if (sk && !r.matchingSkills.some((s) => s.toLowerCase().includes(sk))) return false;
      if (ms && !r.missingSkills.some((s) => s.toLowerCase().includes(ms))) return false;
      if (category && r.category !== category) return false;
      if (stage && r.stage !== stage) return false;
      if (lo != null && (r.years ?? 0) < lo) return false;
      if (hi != null && (r.years ?? 0) > hi) return false;
      return true;
    });

    out.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'submitted') return +new Date(b.submittedAt) - +new Date(a.submittedAt);
      if (sort === 'experience') return (b.years ?? 0) - (a.years ?? 0);
      return (b.score ?? -1) - (a.score ?? -1);
    });
    return out;
  }, [rows, query, skill, missing, category, stage, minYears, maxYears, sort]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else if (next.size < 5) next.add(id);
      return next;
    });
  }

  function compare() {
    setComparing(true);
    const ids = Array.from(selected).join(',');
    router.push(`/recruiter/compare?job=${jobId}&ids=${ids}`);
  }

  const activeFilters = [query, skill, missing, category, stage, minYears, maxYears].filter(Boolean).length;

  return (
    <div>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input className="field" placeholder="Name, email or location" value={query}
               onChange={(e) => setQuery(e.target.value)} aria-label="Search candidates" />
        <input className="field" placeholder="Has skill\u2026" value={skill}
               onChange={(e) => setSkill(e.target.value)} aria-label="Filter by matching skill" />
        <input className="field" placeholder="Missing skill\u2026" value={missing}
               onChange={(e) => setMissing(e.target.value)} aria-label="Filter by missing skill" />
        <select className="field" value={category} onChange={(e) => setCategory(e.target.value)}
                aria-label="Filter by match category">
          <option value="">Any match category</option>
          <option value="strong">Strong match</option>
          <option value="good">Good match</option>
          <option value="potential">Potential match</option>
          <option value="low">Low match</option>
        </select>
        <select className="field" value={stage} onChange={(e) => setStage(e.target.value)}
                aria-label="Filter by stage">
          <option value="">Any stage</option>
          {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
        </select>
        <div className="flex gap-2">
          <input className="field tnum" type="number" min={0} placeholder="Min yrs" value={minYears}
                 onChange={(e) => setMinYears(e.target.value)} aria-label="Minimum years of experience" />
          <input className="field tnum" type="number" min={0} placeholder="Max yrs" value={maxYears}
                 onChange={(e) => setMaxYears(e.target.value)} aria-label="Maximum years of experience" />
        </div>
        <select className="field" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}
                aria-label="Sort candidates">
          <option value="score">Sort: fit score</option>
          <option value="name">Sort: name</option>
          <option value="submitted">Sort: most recent</option>
          <option value="experience">Sort: experience</option>
        </select>
        {activeFilters > 0 && (
          <button className="btn-ghost text-sm"
                  onClick={() => { setQuery(''); setSkill(''); setMissing(''); setCategory(''); setStage(''); setMinYears(''); setMaxYears(''); }}>
            Clear {activeFilters} filter{activeFilters === 1 ? '' : 's'}
          </button>
        )}
      </div>

      {selected.size >= 2 && (
        <div className="mb-4 flex items-center justify-between gap-4 rounded-sharp border border-petrol-500/30 bg-petrol-50 px-4 py-3">
          <p className="text-sm text-petrol-700">
            <span className="tnum font-semibold">{selected.size}</span> selected for comparison
          </p>
          <div className="flex gap-2">
            <button className="btn-ghost text-sm" onClick={() => setSelected(new Set())}>Clear</button>
            <button className="btn-primary text-sm" disabled={comparing} onClick={compare}>
              {comparing ? 'Opening\u2026' : 'Compare'}
            </button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState title="No candidates match those filters"
                    body="Loosen or clear the filters to see the full applicant list." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem]">
            <thead>
              <tr>
                <th className="th w-10"><span className="sr-only">Select</span></th>
                <th className="th w-10">#</th>
                <th className="th">Candidate</th>
                <th className="th text-right">Fit</th>
                <th className="th">Match</th>
                <th className="th text-right">Unmet required</th>
                <th className="th">Stage</th>
                <th className="th" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.id} className={selected.has(r.id) ? 'bg-petrol-50' : undefined}>
                  <td className="td">
                    <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)}
                           aria-label={`Select ${r.name} for comparison`}
                           disabled={!selected.has(r.id) && selected.size >= 5} />
                  </td>
                  <td className="td tnum text-ink-faint">{i + 1}</td>
                  <td className="td">
                    <span className="font-medium">{r.name}</span>
                    <span className="block text-xs text-ink-faint">
                      {r.location || 'Location not stated'}
                      {r.years != null ? ` · ${r.years} yrs` : ''}
                    </span>
                  </td>
                  <td className="td tnum text-right font-semibold">
                    {r.score != null ? r.score.toFixed(0) : <span className="font-normal text-ink-faint">—</span>}
                  </td>
                  <td className="td">
                    {r.category ? <CategoryPill category={r.category} />
                      : <span className="text-xs text-ink-faint">{r.screeningStatus}</span>}
                  </td>
                  <td className="td tnum text-right">
                    {r.requiredUnmet > 0
                      ? <span className="text-evidence-partial">{r.requiredUnmet}</span>
                      : <span className="text-ink-faint">0</span>}
                  </td>
                  <td className="td">
                    <span className="font-mono text-micro uppercase tracking-wider text-ink-muted">
                      {STAGE_LABEL[r.stage] ?? r.stage}
                    </span>
                  </td>
                  <td className="td text-right">
                    <Link href={`/recruiter/applications/${r.id}`}
                          className="text-sm text-petrol-700 hover:underline">Open</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 border-t border-rule pt-3 text-xs leading-relaxed text-ink-faint">
        Ranking orders candidates for review. It does not close applications, and a low
        position never removes a candidate from your pipeline.
      </p>
    </div>
  );
}
