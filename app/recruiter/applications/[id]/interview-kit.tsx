'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Panel, ErrorState, ProcessingState, AiDisclosure } from '@/components/ui';

interface Question {
  question: string; category: string; difficulty: string;
  rationale: string; evaluate: string; grounded_in: string | null; follow_up: string | null;
}

/** Recruiter interview kit (§41). */
export function InterviewKit({ applicationId, initial }: {
  applicationId: string; initial: Question[] | null;
}) {
  const router = useRouter();
  const [questions] = useState<Question[] | null>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  async function generate() {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/applications/${applicationId}/interview-kit`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Questions could not be generated.'); return; }
      router.refresh();
    } catch {
      setError('Questions could not be generated. Check your connection and try again.');
    } finally { setBusy(false); }
  }

  const categories = Array.from(new Set((questions ?? []).map((q) => q.category)));
  const visible = filter ? (questions ?? []).filter((q) => q.category === filter) : (questions ?? []);

  return (
    <Panel eyebrow="Interview intelligence" title="Interview kit"
           action={questions && questions.length > 0 ? (
             <button className="btn-ghost text-sm" disabled={busy} onClick={generate}>
               {busy ? 'Regenerating\u2026' : 'Regenerate'}
             </button>
           ) : undefined}>
      {error && <div className="mb-4"><ErrorState title="Could not generate" body={error} /></div>}

      {busy && (!questions || questions.length === 0) && (
        <ProcessingState label="Building questions from the resume and this role\u2026" />
      )}

      {(!questions || questions.length === 0) && !busy && (
        <div>
          <p className="text-sm text-ink-soft">
            Generate questions grounded in this candidate&rsquo;s resume and this role, weighted
            toward requirements the assessment could not resolve.
          </p>
          <button className="btn-primary mt-4" onClick={generate}>Generate interview kit</button>
        </div>
      )}

      {questions && questions.length > 0 && (
        <>
          <div className="mb-4 flex flex-wrap gap-1.5">
            <button className={`chip ${filter === '' ? 'border-petrol-700 text-petrol-700' : ''}`}
                    onClick={() => setFilter('')}>
              All ({questions.length})
            </button>
            {categories.map((c) => (
              <button key={c} className={`chip ${filter === c ? 'border-petrol-700 text-petrol-700' : ''}`}
                      onClick={() => setFilter(c)}>
                {c.replace(/_/g, ' ')} ({questions.filter((q) => q.category === c).length})
              </button>
            ))}
          </div>

          <ol className="border-t border-rule">
            {visible.map((q, i) => (
              <li key={i} className="border-b border-rule py-4 last:border-b-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-mono text-micro uppercase tracking-wider text-petrol-500">
                    {q.category.replace(/_/g, ' ')}
                  </span>
                  <span className="font-mono text-micro uppercase tracking-wider text-ink-faint">
                    {q.difficulty}
                  </span>
                </div>
                <p className="mt-1.5 text-sm font-medium">{q.question}</p>
                <p className="mt-2 text-xs leading-relaxed text-ink-muted">
                  <span className="font-medium text-ink-soft">Listen for:</span> {q.evaluate}
                </p>
                {q.grounded_in && (
                  <p className="mt-1.5 border-l-2 border-rule pl-3 text-xs italic text-ink-faint">
                    From: {q.grounded_in}
                  </p>
                )}
                {q.follow_up && (
                  <p className="mt-1.5 text-xs text-ink-muted">
                    <span className="font-medium text-ink-soft">Follow up:</span> {q.follow_up}
                  </p>
                )}
              </li>
            ))}
          </ol>
          <AiDisclosure sources="the candidate's resume and this role's requirements" />
        </>
      )}
    </Panel>
  );
}
