'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Panel, CategoryPill, EvidenceBadge, ErrorState, ProcessingState, AiDisclosure } from '@/components/ui';
import { DIMENSION_LABEL, type Dimension, type MatchCategory } from '@/lib/scoring/engine';

export interface CompareCandidate {
  id: string; name: string; years: number | null; stage: string;
  score: number | null; category: MatchCategory | null;
  components: Array<{ dimension: string; raw: number; weight: number }>;
  matrix: Array<{ label: string; importance: string; state: string }>;
  matching: string[]; missing: string[]; strengths: string[]; concerns: string[];
}

interface Insights {
  insights: string[];
  dimension_notes: Array<{ dimension: string; note: string }>;
  caveat: string;
}

export function CompareView({ jobId, jobTitle, candidates }: {
  jobId: string; jobTitle: string; candidates: CompareCandidate[];
}) {
  const [insights, setInsights] = useState<Insights | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/compare', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, applicationIds: candidates.map((c) => c.id) }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Comparison could not be generated.'); return; }
      setInsights(json);
    } catch {
      setError('Comparison could not be generated. Check your connection and try again.');
    } finally { setBusy(false); }
  }

  // Union of every requirement seen, so the matrix rows line up across people.
  const allRequirements = Array.from(
    new Map(candidates.flatMap((c) => c.matrix).map((m) => [m.label, m])).values(),
  );

  const dimensions = Array.from(
    new Set(candidates.flatMap((c) => c.components.map((x) => x.dimension))),
  );

  return (
    <div className="space-y-6">
      <Panel eyebrow="Overview" title="At a glance">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem]">
            <thead>
              <tr>
                <th className="th">Candidate</th>
                <th className="th text-right">Fit</th>
                <th className="th">Match</th>
                <th className="th text-right">Experience</th>
                <th className="th text-right">Requirements met</th>
                <th className="th" />
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => {
                const met = c.matrix.filter((m) => m.state === 'demonstrated').length;
                return (
                  <tr key={c.id}>
                    <td className="td font-medium">{c.name}</td>
                    <td className="td tnum text-right font-semibold">
                      {c.score != null ? c.score.toFixed(0) : '—'}
                    </td>
                    <td className="td">{c.category ? <CategoryPill category={c.category} /> : '—'}</td>
                    <td className="td tnum text-right">{c.years != null ? `${c.years} yrs` : '—'}</td>
                    <td className="td tnum text-right">{met}<span className="text-ink-faint">/{c.matrix.length}</span></td>
                    <td className="td text-right">
                      <Link href={`/recruiter/applications/${c.id}`}
                            className="text-sm text-petrol-700 hover:underline">Open</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel eyebrow="Score components" title="Where each candidate earns their score">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem]">
            <thead>
              <tr>
                <th className="th">Dimension</th>
                {candidates.map((c) => <th key={c.id} className="th text-right">{c.name.split(' ')[0]}</th>)}
              </tr>
            </thead>
            <tbody>
              {dimensions.map((d) => (
                <tr key={d}>
                  <td className="td">{DIMENSION_LABEL[d as Dimension] ?? d}</td>
                  {candidates.map((c) => {
                    const comp = c.components.find((x) => x.dimension === d);
                    const best = Math.max(...candidates.map((o) => o.components.find((x) => x.dimension === d)?.raw ?? 0));
                    const isBest = comp && comp.raw === best && best > 0;
                    return (
                      <td key={c.id} className={`td tnum text-right ${isBest ? 'font-semibold text-petrol-700' : ''}`}>
                        {comp && comp.weight > 0 ? comp.raw.toFixed(0) : '—'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel eyebrow="Requirement matrix" title="Evidence coverage side by side">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem]">
            <thead>
              <tr>
                <th className="th">Requirement</th>
                {candidates.map((c) => <th key={c.id} className="th">{c.name.split(' ')[0]}</th>)}
              </tr>
            </thead>
            <tbody>
              {allRequirements.map((req) => (
                <tr key={req.label}>
                  <td className="td">
                    <span className="text-sm">{req.label}</span>
                    <span className="block font-mono text-micro uppercase tracking-wider text-ink-faint">
                      {String(req.importance).replace(/_/g, ' ')}
                    </span>
                  </td>
                  {candidates.map((c) => {
                    const m = c.matrix.find((x) => x.label === req.label);
                    return (
                      <td key={c.id} className="td">
                        {m ? <EvidenceBadge state={m.state as 'demonstrated' | 'insufficient' | 'not_demonstrated'} />
                           : <span className="text-xs text-ink-faint">—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel eyebrow="Comparative insight" title="Tradeoffs">
        {error && <div className="mb-4"><ErrorState title="Could not generate" body={error} /></div>}

        {busy && <ProcessingState label="Comparing evidence across candidates\u2026" />}

        {!insights && !busy && (
          <div>
            <p className="text-sm text-ink-soft">
              Generate a written comparison grounded in the assessments above. It describes
              tradeoffs rather than picking a winner.
            </p>
            <button className="btn-primary mt-4" onClick={generate}>Generate comparison</button>
          </div>
        )}

        {insights && (
          <div className="space-y-4">
            <ul className="space-y-2.5">
              {insights.insights.map((s, i) => (
                <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-ink-soft">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-petrol-500" aria-hidden />{s}
                </li>
              ))}
            </ul>

            {insights.dimension_notes.length > 0 && (
              <div className="border-t border-rule pt-4">
                {insights.dimension_notes.map((d, i) => (
                  <div key={i} className="border-b border-rule py-2.5 last:border-b-0">
                    <p className="eyebrow mb-1">{d.dimension}</p>
                    <p className="text-sm text-ink-soft">{d.note}</p>
                  </div>
                ))}
              </div>
            )}

            <p className="rounded-sharp border border-rule bg-wash px-4 py-3 text-xs leading-relaxed text-ink-muted">
              {insights.caveat}
            </p>
            <AiDisclosure sources={`the stored assessments for ${jobTitle}`} />
          </div>
        )}
      </Panel>
    </div>
  );
}
