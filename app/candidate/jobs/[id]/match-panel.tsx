'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Panel, ErrorState, ProcessingState, AiDisclosure } from '@/components/ui';

interface Match {
  matching_strengths: string[];
  gaps: Array<{ area: string; note: string; addressable: boolean }>;
  explanation: string;
}

/**
 * Candidate-side match view (§29).
 * Deliberately shows no numeric score, no ranking, and no reference to
 * other applicants — a candidate must not be able to infer their position.
 */
export function MatchPanel({ jobId, jobTitle, isOpen, existingApplicationId, hasResume, resumeReady }: {
  jobId: string; jobTitle: string; isOpen: boolean;
  existingApplicationId: string | null; hasResume: boolean; resumeReady: boolean;
}) {
  const router = useRouter();
  const [match, setMatch] = useState<Match | null>(null);
  const [loadingMatch, setLoadingMatch] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appliedId, setAppliedId] = useState<string | null>(existingApplicationId);

  async function loadMatch() {
    setLoadingMatch(true); setError(null);
    try {
      const res = await fetch('/api/match/preview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Your match could not be generated.'); return; }
      setMatch(json);
    } catch {
      setError('Your match could not be generated. Check your connection and try again.');
    } finally { setLoadingMatch(false); }
  }

  async function apply() {
    setApplying(true); setError(null);
    try {
      const res = await fetch('/api/applications', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Your application could not be submitted.'); return; }
      setAppliedId(json.id);
      fetch('/api/worker/drain', { method: 'POST' }).catch(() => {});
      router.refresh();
    } catch {
      setError('Your application could not be submitted. Check your connection and try again.');
    } finally { setApplying(false); }
  }

  if (appliedId) {
    return (
      <Panel eyebrow="Application" title="You have applied">
        <p className="text-sm text-ink-soft">
          Your application for {jobTitle} is in the hiring team&rsquo;s workflow. Screening runs
          automatically — you do not need to do anything else.
        </p>
        <Link href={`/candidate/applications/${appliedId}`} className="btn-secondary mt-4">
          Track this application
        </Link>
        <p className="mt-4 border-t border-rule pt-3 text-xs text-ink-faint">
          Applications cannot be withdrawn once submitted.
        </p>
      </Panel>
    );
  }

  return (
    <div className="space-y-6">
      <Panel eyebrow="Your match" title="How you line up">
        {!hasResume && (
          <div>
            <p className="text-sm text-ink-soft">Upload a resume to see how you match this role.</p>
            <Link href="/candidate/resume" className="btn-primary mt-4">Upload resume</Link>
          </div>
        )}

        {hasResume && !resumeReady && (
          <div>
            <ProcessingState label="Your resume is still being processed." />
            <p className="mt-3 text-sm text-ink-muted">
              Matching becomes available once analysis finishes.
            </p>
          </div>
        )}

        {resumeReady && !match && !loadingMatch && (
          <div>
            <p className="text-sm text-ink-soft">
              See which requirements your resume already evidences, and where it is thin,
              before you apply.
            </p>
            <button className="btn-primary mt-4" onClick={loadMatch}>Check my match</button>
          </div>
        )}

        {loadingMatch && <ProcessingState label="Comparing your resume against this role\u2026" />}

        {match && (
          <div className="space-y-5">
            <p className="text-sm leading-relaxed text-ink-soft">{match.explanation}</p>

            {match.matching_strengths.length > 0 && (
              <div>
                <p className="eyebrow mb-2">What lines up</p>
                <ul className="space-y-2">
                  {match.matching_strengths.map((s, i) => (
                    <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-ink-soft">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-evidence-yes" aria-hidden />{s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {match.gaps.length > 0 && (
              <div>
                <p className="eyebrow mb-2">Where your resume is thin</p>
                <div className="border-t border-rule">
                  {match.gaps.map((g, i) => (
                    <div key={i} className="border-b border-rule py-2.5 last:border-b-0">
                      <div className="flex flex-wrap items-baseline gap-x-3">
                        <span className="text-sm font-medium">{g.area}</span>
                        <span className={`font-mono text-micro uppercase tracking-wider ${
                          g.addressable ? 'text-evidence-partial' : 'text-ink-faint'}`}>
                          {g.addressable ? 'Rewordable' : 'Needs experience'}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-ink-muted">{g.note}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-ink-faint">
                  A gap marked rewordable usually means the experience is there but the
                  resume does not say it plainly.
                </p>
              </div>
            )}

            <AiDisclosure sources="your resume and this role's published requirements" />
          </div>
        )}
      </Panel>

      {error && <ErrorState title="Something went wrong" body={error} />}

      <Panel eyebrow="Apply" title="Submit your application">
        {!isOpen ? (
          <p className="text-sm text-ink-muted">This role is closed to new applications.</p>
        ) : (
          <>
            <p className="text-sm text-ink-soft">
              Applying attaches your current resume and starts screening automatically.
            </p>
            <button className="btn-primary mt-4" disabled={!resumeReady || applying} onClick={apply}>
              {applying ? 'Submitting\u2026' : 'Apply to this role'}
            </button>
            {!resumeReady && (
              <p className="mt-2 text-xs text-ink-faint">A processed resume is required before applying.</p>
            )}
            <p className="mt-4 border-t border-rule pt-3 text-xs text-ink-faint">
              Applications cannot be withdrawn once submitted.
            </p>
          </>
        )}
      </Panel>
    </div>
  );
}
