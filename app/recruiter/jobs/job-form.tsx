'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Panel, ErrorState } from '@/components/ui';

export interface JobValues {
  title: string; company: string; location: string;
  employmentType: 'full_time' | 'part_time' | 'contract' | 'internship';
  description: string; responsibilities: string[]; preferredQuals: string[]; niceToHave: string[];
  experienceMin: number | null; experienceMax: number | null; educationLevel: string;
  status: 'draft' | 'active' | 'closed';
}

const EMPTY: JobValues = {
  title: '', company: '', location: '', employmentType: 'full_time',
  description: '', responsibilities: [], preferredQuals: [], niceToHave: [],
  experienceMin: null, experienceMax: null, educationLevel: '', status: 'draft',
};

export function JobForm({ mode, jobId, initial }: {
  mode: 'create' | 'edit'; jobId?: string; initial?: JobValues;
}) {
  const router = useRouter();
  const [v, setV] = useState<JobValues>(initial ?? EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function set<K extends keyof JobValues>(k: K, value: JobValues[K]) {
    setV((p) => ({ ...p, [k]: value }));
  }

  async function submit(e: React.FormEvent, publish: boolean) {
    e.preventDefault();
    setBusy(true); setError(null); setFieldErrors({});

    const payload = {
      ...v,
      educationLevel: v.educationLevel || null,
      status: publish ? 'active' : v.status === 'closed' ? 'closed' : 'draft',
    };

    try {
      const res = await fetch(mode === 'create' ? '/api/jobs' : `/api/jobs/${jobId}`, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? 'The role could not be saved.');
        if (Array.isArray(json.fields)) {
          setFieldErrors(Object.fromEntries(json.fields.map((f: { path: string; message: string }) => [f.path, f.message])));
        }
        return;
      }

      fetch('/api/worker/drain', { method: 'POST' }).catch(() => {});
      router.push(`/recruiter/jobs/${mode === 'create' ? json.id : jobId}`);
      router.refresh();
    } catch {
      setError('The role could not be saved. Check your connection and try again.');
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={(e) => submit(e, false)} className="space-y-6">
      <Panel eyebrow="Basics" title="Role details">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Job title" required error={fieldErrors.title}>
            <input className="field" required maxLength={160} value={v.title}
                   onChange={(e) => set('title', e.target.value)} placeholder="e.g. Senior Data Engineer" />
          </Field>
          <Field label="Company" required error={fieldErrors.company}>
            <input className="field" required maxLength={160} value={v.company}
                   onChange={(e) => set('company', e.target.value)} />
          </Field>
          <Field label="Location" required error={fieldErrors.location}>
            <input className="field" required maxLength={160} value={v.location}
                   onChange={(e) => set('location', e.target.value)} placeholder="City, Country or Remote" />
          </Field>
          <Field label="Employment type">
            <select className="field" value={v.employmentType}
                    onChange={(e) => set('employmentType', e.target.value as JobValues['employmentType'])}>
              <option value="full_time">Full time</option>
              <option value="part_time">Part time</option>
              <option value="contract">Contract</option>
              <option value="internship">Internship</option>
            </select>
          </Field>
          <Field label="Minimum years of experience">
            <input className="field tnum" type="number" min={0} max={60} step={0.5} value={v.experienceMin ?? ''}
                   onChange={(e) => set('experienceMin', e.target.value === '' ? null : Number(e.target.value))} />
          </Field>
          <Field label="Maximum years of experience">
            <input className="field tnum" type="number" min={0} max={60} step={0.5} value={v.experienceMax ?? ''}
                   onChange={(e) => set('experienceMax', e.target.value === '' ? null : Number(e.target.value))} />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Education level" hint="Leave blank if no formal requirement">
            <input className="field" maxLength={120} value={v.educationLevel}
                   onChange={(e) => set('educationLevel', e.target.value)}
                   placeholder="e.g. Bachelor's degree in a numerate discipline" />
          </Field>
        </div>
      </Panel>

      <Panel eyebrow="Description" title="The posting">
        <Field label="Role description" required error={fieldErrors.description}
               hint="Write naturally. Specific, concrete requirements produce a sharper specification than vague ones.">
          <textarea className="field" rows={10} required minLength={40} maxLength={20000} value={v.description}
                    onChange={(e) => set('description', e.target.value)} />
          <p className="tnum mt-1 text-right text-xs text-ink-faint">{v.description.length} characters</p>
        </Field>
      </Panel>

      <ListField label="Responsibilities" items={v.responsibilities} onChange={(x) => set('responsibilities', x)}
                 placeholder="Add a responsibility" />
      <ListField label="Preferred qualifications" items={v.preferredQuals} onChange={(x) => set('preferredQuals', x)}
                 placeholder="Add a preferred qualification" />
      <ListField label="Nice to have" items={v.niceToHave} onChange={(x) => set('niceToHave', x)}
                 placeholder="Add a nice-to-have" />

      {error && <ErrorState title="Could not save" body={error} />}

      <div className="flex flex-wrap gap-3">
        <button type="submit" className="btn-secondary" disabled={busy}>
          {busy ? 'Saving\u2026' : 'Save as draft'}
        </button>
        <button type="button" className="btn-primary" disabled={busy} onClick={(e) => submit(e, true)}>
          {busy ? 'Publishing\u2026' : 'Publish role'}
        </button>
      </div>
      <p className="text-xs text-ink-faint">
        Publishing makes the role visible on the public job board and opens it to applications.
      </p>
    </form>
  );
}

function ListField({ label, items, onChange, placeholder }: {
  label: string; items: string[]; onChange: (v: string[]) => void; placeholder: string;
}) {
  const [draft, setDraft] = useState('');
  function add() {
    const t = draft.trim();
    if (!t) return;
    onChange([...items, t]); setDraft('');
  }
  return (
    <Panel eyebrow="Detail" title={label}>
      {items.length > 0 && (
        <ul className="mb-4 border-t border-rule">
          {items.map((it, i) => (
            <li key={i} className="flex items-start justify-between gap-3 border-b border-rule py-2.5">
              <span className="text-sm text-ink-soft">{it}</span>
              <button type="button" className="shrink-0 text-xs text-ink-faint hover:text-evidence-no"
                      onClick={() => onChange(items.filter((_, x) => x !== i))}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input className="field" value={draft} placeholder={placeholder} maxLength={400}
               onChange={(e) => setDraft(e.target.value)}
               onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
        <button type="button" className="btn-secondary shrink-0" onClick={add}>Add</button>
      </div>
    </Panel>
  );
}

function Field({ label, hint, required, error, children }: {
  label: string; hint?: string; required?: boolean; error?: string; children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">
        {label}{required && <span className="text-evidence-no"> *</span>}
      </span>
      {children}
      {error && <span className="mt-1 block text-xs text-evidence-no">{error}</span>}
      {hint && !error && <span className="mt-1 block text-xs text-ink-faint">{hint}</span>}
    </label>
  );
}
