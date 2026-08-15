'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Panel, ErrorState } from '@/components/ui';

interface Values {
  fullName: string; phone: string; location: string; headline: string;
  summary: string; linkedinUrl: string; portfolioUrl: string; yearsExperience: number | null;
}

export function ProfileForm({ initial, completeness }: { initial: Values; completeness: number }) {
  const router = useRouter();
  const [v, setV] = useState<Values>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setV((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...v,
          linkedinUrl: v.linkedinUrl || null,
          portfolioUrl: v.portfolioUrl || null,
          yearsExperience: v.yearsExperience,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Your profile could not be saved.'); return; }
      setSaved(true);
      router.refresh();
    } catch {
      setError('Your profile could not be saved. Check your connection and try again.');
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <Panel eyebrow={`${completeness}% complete`} title="About you">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" required>
            <input className="field" value={v.fullName} required maxLength={120}
                   onChange={(e) => set('fullName', e.target.value)} />
          </Field>
          <Field label="Location">
            <input className="field" value={v.location} maxLength={120}
                   onChange={(e) => set('location', e.target.value)} placeholder="City, Country" />
          </Field>
          <Field label="Phone">
            <input className="field" value={v.phone} maxLength={40} type="tel"
                   onChange={(e) => set('phone', e.target.value)} />
          </Field>
          <Field label="Years of experience">
            <input className="field tnum" type="number" min={0} max={60} step={0.5}
                   value={v.yearsExperience ?? ''}
                   onChange={(e) => set('yearsExperience', e.target.value === '' ? null : Number(e.target.value))} />
          </Field>
        </div>

        <div className="mt-4">
          <Field label="Headline" hint="One line, as it would appear under your name">
            <input className="field" value={v.headline} maxLength={160}
                   onChange={(e) => set('headline', e.target.value)}
                   placeholder="e.g. Data Engineer focused on streaming pipelines" />
          </Field>
        </div>

        <div className="mt-4">
          <Field label="Professional summary" hint="Two or three sentences on what you do and what you are looking for">
            <textarea className="field" rows={5} value={v.summary} maxLength={2000}
                      onChange={(e) => set('summary', e.target.value)} />
            <p className="tnum mt-1 text-right text-xs text-ink-faint">{v.summary.length}/2000</p>
          </Field>
        </div>
      </Panel>

      <Panel eyebrow="Links" title="Where else to find you">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="LinkedIn">
            <input className="field" type="url" value={v.linkedinUrl} maxLength={300}
                   onChange={(e) => set('linkedinUrl', e.target.value)}
                   placeholder="https://linkedin.com/in/\u2026" />
          </Field>
          <Field label="Portfolio or GitHub">
            <input className="field" type="url" value={v.portfolioUrl} maxLength={300}
                   onChange={(e) => set('portfolioUrl', e.target.value)}
                   placeholder="https://\u2026" />
          </Field>
        </div>
      </Panel>

      {error && <ErrorState title="Could not save" body={error} />}

      <div className="flex items-center gap-4">
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? 'Saving\u2026' : 'Save profile'}
        </button>
        {saved && <p className="text-sm text-evidence-yes" role="status">Profile saved.</p>}
      </div>
    </form>
  );
}

function Field({ label, hint, required, children }: {
  label: string; hint?: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">
        {label}{required && <span className="text-evidence-no"> *</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-faint">{hint}</span>}
    </label>
  );
}
