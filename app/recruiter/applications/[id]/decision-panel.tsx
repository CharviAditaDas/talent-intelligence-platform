'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Panel, ErrorState, CategoryPill } from '@/components/ui';
import { STAGE_LABEL } from '@/components/stage-tracker';
import type { MatchCategory } from '@/lib/scoring/engine';

const STAGES = [
  'submitted', 'ai_screening', 'under_review', 'shortlisted',
  'interview_1', 'interview_2', 'final_evaluation', 'offer', 'hired', 'rejected',
] as const;

interface Note { id: string; body: string; createdAt: string }

/**
 * Recruiter decision surface (§46).
 * The recruiter's stage is stored separately from the AI assessment and never
 * overwrites it — so a deliberate disagreement between the two stays visible.
 */
export function DecisionPanel({ applicationId, stage, aiScore, aiCategory, notes, tags }: {
  applicationId: string; stage: string;
  aiScore: number | null; aiCategory: MatchCategory | null;
  notes: Note[]; tags: string[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [tagDraft, setTagDraft] = useState('');
  const [localNotes, setLocalNotes] = useState(notes);
  const [localTags, setLocalTags] = useState(tags);

  async function moveTo(next: string) {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/applications/${applicationId}/stage`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: next }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'The stage could not be updated.'); return; }
      router.refresh();
    } catch {
      setError('The stage could not be updated. Check your connection and try again.');
    } finally { setBusy(false); }
  }

  async function addNote() {
    const body = noteDraft.trim();
    if (!body) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/applications/${applicationId}/notes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'The note could not be saved.'); return; }
      setLocalNotes([{ id: json.id, body: json.body, createdAt: json.created_at }, ...localNotes]);
      setNoteDraft('');
    } catch {
      setError('The note could not be saved.');
    } finally { setBusy(false); }
  }

  async function addTag() {
    const tag = tagDraft.trim().toLowerCase();
    if (!tag || localTags.includes(tag)) { setTagDraft(''); return; }
    setLocalTags([...localTags, tag]); setTagDraft('');
    await fetch(`/api/applications/${applicationId}/tags`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag }),
    }).catch(() => {});
  }

  async function removeTag(tag: string) {
    setLocalTags(localTags.filter((t) => t !== tag));
    await fetch(`/api/applications/${applicationId}/tags?tag=${encodeURIComponent(tag)}`, {
      method: 'DELETE',
    }).catch(() => {});
  }

  async function rescreen() {
    setBusy(true); setError(null);
    try {
      await fetch(`/api/applications/${applicationId}/rescreen`, { method: 'POST' });
      await fetch('/api/worker/drain', { method: 'POST' });
      setTimeout(() => router.refresh(), 3000);
    } finally { setBusy(false); }
  }

  const overridden = aiCategory != null &&
    ((aiCategory === 'low' && ['shortlisted', 'interview_1', 'interview_2', 'final_evaluation', 'offer', 'hired'].includes(stage)) ||
     (aiCategory === 'strong' && stage === 'rejected'));

  return (
    <Panel eyebrow="Decision" title="Your assessment">
      <div className="rounded-sharp border border-rule bg-wash px-4 py-3">
        <p className="eyebrow mb-1.5">Automated assessment</p>
        <div className="flex items-center gap-3">
          {aiScore != null ? (
            <>
              <span className="tnum text-lg font-semibold">{aiScore.toFixed(0)}</span>
              {aiCategory && <CategoryPill category={aiCategory} />}
            </>
          ) : <span className="text-sm text-ink-muted">Not yet assessed</span>}
        </div>
        <p className="mt-2 text-xs text-ink-faint">Fixed once computed. Your decision does not change it.</p>
      </div>

      <div className="mt-4">
        <label htmlFor="stage" className="mb-1.5 block text-sm font-medium">Recruitment stage</label>
        <select id="stage" className="field" value={stage} disabled={busy}
                onChange={(e) => moveTo(e.target.value)}>
          {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
        </select>
        {overridden && (
          <p className="mt-2 rounded-sharp border border-petrol-500/30 bg-petrol-50 px-3 py-2 text-xs text-petrol-700">
            Your decision differs from the automated assessment. That is recorded as-is —
            both are kept, and neither overwrites the other.
          </p>
        )}
      </div>

      <div className="mt-5 border-t border-rule pt-4">
        <p className="eyebrow mb-2">Tags</p>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {localTags.map((t) => (
            <button key={t} className="chip hover:border-evidence-no hover:text-evidence-no"
                    onClick={() => removeTag(t)} title="Remove tag">
              {t} <span aria-hidden>&times;</span>
            </button>
          ))}
          {localTags.length === 0 && <span className="text-xs text-ink-faint">No tags</span>}
        </div>
        <div className="flex gap-2">
          <input className="field" value={tagDraft} maxLength={40} placeholder="Add a tag"
                 onChange={(e) => setTagDraft(e.target.value)}
                 onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} />
          <button className="btn-secondary shrink-0 text-sm" onClick={addTag}>Add</button>
        </div>
      </div>

      <div className="mt-5 border-t border-rule pt-4">
        <p className="eyebrow mb-2">Private notes</p>
        <textarea className="field" rows={3} value={noteDraft} maxLength={4000}
                  placeholder="Visible only to you. Never shown to the candidate."
                  onChange={(e) => setNoteDraft(e.target.value)} />
        <button className="btn-secondary mt-2 text-sm" disabled={busy || !noteDraft.trim()} onClick={addNote}>
          Add note
        </button>

        {localNotes.length > 0 && (
          <ul className="mt-4 space-y-3">
            {localNotes.map((n) => (
              <li key={n.id} className="border-l-2 border-rule pl-3">
                <p className="whitespace-pre-wrap text-sm text-ink-soft">{n.body}</p>
                <p className="tnum mt-0.5 text-xs text-ink-faint">
                  {new Date(n.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <div className="mt-4"><ErrorState title="Action failed" body={error} /></div>}

      <div className="mt-5 border-t border-rule pt-4">
        <button className="btn-ghost text-sm" disabled={busy} onClick={rescreen}>
          Re-run assessment
        </button>
        <p className="mt-1 text-xs text-ink-faint">
          Assessments are cached. Use this after a material change.
        </p>
      </div>
    </Panel>
  );
}
