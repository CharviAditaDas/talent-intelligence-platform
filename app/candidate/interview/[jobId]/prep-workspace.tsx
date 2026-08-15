'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Panel, ErrorState, ProcessingState, EmptyState, AiDisclosure } from '@/components/ui';

interface Question {
  question: string; category: string; difficulty: string;
  rationale: string; evaluate: string; grounded_in: string | null;
  follow_up: string | null; answer_structure: string;
}

interface Feedback {
  did_well: string[]; improve: string[]; missing_points: string[];
  ratings: { relevance: number; clarity: number; structure: number; depth: number };
  suggested_structure: string; follow_up: string;
}

export function PrepWorkspace({ jobId, jobTitle, prepId, initialQuestions }: {
  jobId: string; jobTitle: string; prepId: string | null; initialQuestions: Question[] | null;
}) {
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[] | null>(initialQuestions);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  async function generate(force = false) {
    setGenerating(true); setError(null);
    try {
      const res = await fetch('/api/interview/prep', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, force }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Preparation could not be generated.'); return; }
      router.refresh();
      // The page reloads with the stored prep; refresh handles the data.
      setTimeout(() => router.refresh(), 500);
    } catch {
      setError('Preparation could not be generated. Check your connection and try again.');
    } finally { setGenerating(false); }
  }

  if (!questions || questions.length === 0) {
    return (
      <div className="space-y-6">
        {error && <ErrorState title="Could not generate" body={error} />}
        {generating ? (
          <Panel eyebrow="Generating" title="Building your question set">
            <ProcessingState label="Reading your resume against this role\u2026" />
          </Panel>
        ) : (
          <EmptyState
            title="No preparation generated yet"
            body="Questions will be drawn from your resume and this role's requirements, with guidance on how to structure each answer."
            action={<button className="btn-primary" onClick={() => generate(false)}>Generate questions</button>}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && <ErrorState title="Something went wrong" body={error} />}

      <div className="flex items-center justify-between gap-4">
        <p className="tnum text-sm text-ink-muted">{questions.length} questions</p>
        <button className="btn-ghost text-sm" disabled={generating} onClick={() => generate(true)}>
          {generating ? 'Regenerating\u2026' : 'Regenerate'}
        </button>
      </div>

      <div className="space-y-4">
        {questions.map((q, i) => (
          <QuestionCard
            key={i} index={i} question={q} jobTitle={jobTitle} prepId={prepId}
            open={openIndex === i} onToggle={() => setOpenIndex(openIndex === i ? null : i)}
          />
        ))}
      </div>
    </div>
  );
}

function QuestionCard({ index, question, jobTitle, prepId, open, onToggle }: {
  index: number; question: Question; jobTitle: string; prepId: string | null;
  open: boolean; onToggle: () => void;
}) {
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/interview/practice', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prepId, jobTitle, question: question.question, answer }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Feedback could not be generated.'); return; }
      setFeedback(json.feedback);
    } catch {
      setError('Feedback could not be generated. Check your connection and try again.');
    } finally { setBusy(false); }
  }

  return (
    <div className="panel">
      <button type="button" onClick={onToggle}
              aria-expanded={open}
              className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left hover:bg-wash">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-mono text-micro uppercase tracking-wider text-petrol-500">
              {question.category.replace(/_/g, ' ')}
            </span>
            <span className="font-mono text-micro uppercase tracking-wider text-ink-faint">
              {question.difficulty}
            </span>
          </div>
          <p className="mt-1.5 text-sm font-medium">{question.question}</p>
        </div>
        <span aria-hidden className="mt-1 shrink-0 font-mono text-xs text-ink-faint">
          {open ? '\u2212' : '+'}
        </span>
      </button>

      {open && (
        <div className="border-t border-rule px-5 py-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <p className="eyebrow mb-1.5">Why this is asked</p>
              <p className="text-sm text-ink-soft">{question.rationale}</p>
            </div>
            <div>
              <p className="eyebrow mb-1.5">How to structure an answer</p>
              <p className="text-sm text-ink-soft">{question.answer_structure}</p>
            </div>
          </div>

          {question.grounded_in && (
            <p className="mt-4 border-l-2 border-rule pl-3 text-xs italic text-ink-muted">
              Drawn from: {question.grounded_in}
            </p>
          )}

          <div className="mt-5 border-t border-rule pt-5">
            <label htmlFor={`ans-${index}`} className="mb-1.5 block text-sm font-medium">
              Practise your answer
            </label>
            <textarea id={`ans-${index}`} rows={6} className="field" value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      placeholder="Answer as you would out loud. Feedback assesses only what you actually write." />
            <div className="mt-3 flex items-center gap-3">
              <button className="btn-primary" disabled={busy || answer.trim().length < 20} onClick={submit}>
                {busy ? 'Reviewing\u2026' : 'Get feedback'}
              </button>
              <span className="tnum text-xs text-ink-faint">{answer.trim().length} characters</span>
            </div>
          </div>

          {error && <div className="mt-4"><ErrorState title="Could not review" body={error} /></div>}

          {feedback && (
            <div className="mt-5 border-t border-rule pt-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(['relevance', 'clarity', 'structure', 'depth'] as const).map((k) => (
                  <div key={k} className="border-l-2 border-rule pl-3">
                    <p className="eyebrow">{k}</p>
                    <p className="tnum text-lg font-semibold">{feedback.ratings[k].toFixed(1)}<span className="text-sm text-ink-faint">/5</span></p>
                  </div>
                ))}
              </div>

              <FeedbackList label="What worked" items={feedback.did_well} tone="yes" />
              <FeedbackList label="What to improve" items={feedback.improve} tone="partial" />
              <FeedbackList label="Points you did not cover" items={feedback.missing_points} tone="no" />

              <div className="mt-4">
                <p className="eyebrow mb-1.5">A stronger structure</p>
                <p className="text-sm leading-relaxed text-ink-soft">{feedback.suggested_structure}</p>
              </div>
              <div className="mt-4 rounded-sharp border border-rule bg-wash px-4 py-3">
                <p className="eyebrow mb-1">Likely follow-up</p>
                <p className="text-sm text-ink-soft">{feedback.follow_up}</p>
              </div>
              <AiDisclosure sources="the answer you wrote above" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FeedbackList({ label, items, tone }: { label: string; items: string[]; tone: 'yes' | 'partial' | 'no' }) {
  if (items.length === 0) return null;
  const dot = { yes: 'bg-evidence-yes', partial: 'bg-evidence-partial', no: 'bg-evidence-no' }[tone];
  return (
    <div className="mt-4">
      <p className="eyebrow mb-1.5">{label}</p>
      <ul className="space-y-1.5">
        {items.map((s, i) => (
          <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-ink-soft">
            <span className={`mt-1.5 h-1 w-1 shrink-0 rounded-full ${dot}`} aria-hidden />{s}
          </li>
        ))}
      </ul>
    </div>
  );
}
