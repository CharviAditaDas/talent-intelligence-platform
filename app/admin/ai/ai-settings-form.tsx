'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Panel, ErrorState } from '@/components/ui';

interface Settings {
  model: string; enabled: boolean; maxAttempts: number;
  backoffMs: number; features: Record<string, boolean>;
}

const FEATURE_LABELS: Record<string, string> = {
  resume_analysis: 'Resume analysis',
  job_analysis: 'Job specification derivation',
  screening: 'Application screening',
  interview_kit: 'Recruiter interview kits',
  interview_prep: 'Candidate interview preparation',
  practice_feedback: 'Practice answer feedback',
  comparison: 'Candidate comparison',
  rewrite: 'Resume section rewriting',
};

export function AiSettingsForm({ initial, provider }: { initial: Settings; provider: string }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true); setError(null); setSaved(false);
    try {
      const res = await fetch('/api/admin/ai-settings', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(v),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Settings could not be saved.'); return; }
      setSaved(true);
      router.refresh();
    } catch {
      setError('Settings could not be saved.');
    } finally { setBusy(false); }
  }

  return (
    <Panel eyebrow="Configuration" title="AI service">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 border-b border-rule pb-3">
          <div>
            <p className="text-sm font-medium">Provider</p>
            <p className="text-xs text-ink-faint">Set at deploy time</p>
          </div>
          <span className="font-mono text-xs">{provider}</span>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Model</span>
          <input className="field font-mono text-xs" value={v.model} maxLength={120}
                 onChange={(e) => { setV({ ...v, model: e.target.value }); setSaved(false); }} />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Retry attempts</span>
            <input className="field tnum" type="number" min={1} max={10} value={v.maxAttempts}
                   onChange={(e) => { setV({ ...v, maxAttempts: Number(e.target.value) }); setSaved(false); }} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Base backoff (ms)</span>
            <input className="field tnum" type="number" min={250} max={120000} step={250} value={v.backoffMs}
                   onChange={(e) => { setV({ ...v, backoffMs: Number(e.target.value) }); setSaved(false); }} />
          </label>
        </div>

        <label className="flex items-center gap-3 border-t border-rule pt-4">
          <input type="checkbox" checked={v.enabled}
                 onChange={(e) => { setV({ ...v, enabled: e.target.checked }); setSaved(false); }} />
          <span className="text-sm">
            <span className="font-medium">AI service enabled</span>
            <span className="block text-xs text-ink-faint">
              When off, work is still queued and processed once re-enabled — nothing is dropped.
            </span>
          </span>
        </label>

        <div className="border-t border-rule pt-4">
          <p className="eyebrow mb-2">Features</p>
          <div className="space-y-2">
            {Object.keys(FEATURE_LABELS).map((key) => (
              <label key={key} className="flex items-center gap-3">
                <input type="checkbox" checked={v.features[key] ?? true}
                       onChange={(e) => {
                         setV({ ...v, features: { ...v.features, [key]: e.target.checked } });
                         setSaved(false);
                       }} />
                <span className="text-sm">{FEATURE_LABELS[key]}</span>
              </label>
            ))}
          </div>
        </div>

        {error && <ErrorState title="Could not save" body={error} />}

        <div className="flex items-center gap-4 border-t border-rule pt-4">
          <button className="btn-primary" disabled={busy} onClick={save}>
            {busy ? 'Saving\u2026' : 'Save settings'}
          </button>
          {saved && <p className="text-sm text-evidence-yes" role="status">Settings saved.</p>}
        </div>

        <p className="text-xs leading-relaxed text-ink-faint">
          API credentials are read from server environment variables. They are not stored in the
          database, not returned by any API route, and not rendered in this interface.
        </p>
      </div>
    </Panel>
  );
}
