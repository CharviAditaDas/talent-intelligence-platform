import type { ReactNode } from 'react';
import { CATEGORY_LABEL, type MatchCategory } from '@/lib/scoring/engine';

export function Panel({ title, eyebrow, action, children, className = '' }: {
  title?: string; eyebrow?: string; action?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {(title || eyebrow || action) && (
        <header className="flex items-start justify-between gap-4 border-b border-rule px-5 py-4 sm:px-6">
          <div>
            {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
            {title && <h2 className="text-base font-semibold tracking-tight">{title}</h2>}
          </div>
          {action}
        </header>
      )}
      <div className="panel-pad">{children}</div>
    </section>
  );
}

/** Evidence state pill. Colour is reserved exclusively for this meaning. */
export function EvidenceBadge({ state }: { state: 'demonstrated' | 'insufficient' | 'not_demonstrated' }) {
  const map = {
    demonstrated: { label: 'Demonstrated', cls: 'text-evidence-yes border-evidence-yes/30 bg-evidence-yes/5' },
    insufficient: { label: 'Insufficient evidence', cls: 'text-evidence-partial border-evidence-partial/30 bg-evidence-partial/5' },
    not_demonstrated: { label: 'Not demonstrated', cls: 'text-evidence-no border-evidence-no/30 bg-evidence-no/5' },
  }[state];
  return (
    <span className={`inline-flex items-center rounded-sharp border px-2 py-0.5 font-mono text-micro uppercase tracking-wider ${map.cls}`}>
      {map.label}
    </span>
  );
}

export function ImportanceTag({ importance }: { importance: 'required' | 'preferred' | 'nice_to_have' }) {
  const label = { required: 'Required', preferred: 'Preferred', nice_to_have: 'Nice to have' }[importance];
  const weight = importance === 'required' ? 'text-ink font-semibold' : 'text-ink-faint';
  return <span className={`font-mono text-micro uppercase tracking-wider ${weight}`}>{label}</span>;
}

export function ScoreDial({ value, category, size = 'md' }: {
  value: number; category: MatchCategory; size?: 'sm' | 'md' | 'lg';
}) {
  const dim = { sm: 56, md: 84, lg: 112 }[size];
  const stroke = size === 'sm' ? 5 : size === 'md' ? 7 : 9;
  const r = (dim - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const filled = (Math.min(100, Math.max(0, value)) / 100) * circumference;
  const colour = { strong: '#15803D', good: '#0F3D4C', potential: '#B45309', low: '#9F1239' }[category];
  return (
    <div className="inline-flex items-center gap-3">
      <svg width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`} role="img"
           aria-label={`Fit score ${value.toFixed(0)} out of 100, ${CATEGORY_LABEL[category]}`}>
        <circle cx={dim/2} cy={dim/2} r={r} fill="none" stroke="#DCE1E7" strokeWidth={stroke} />
        <circle cx={dim/2} cy={dim/2} r={r} fill="none" stroke={colour} strokeWidth={stroke}
                strokeDasharray={`${filled} ${circumference}`} strokeLinecap="butt"
                transform={`rotate(-90 ${dim/2} ${dim/2})`} />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
              className="tnum font-semibold" fontSize={dim * 0.28} fill="#0E1621">
          {value.toFixed(0)}
        </text>
      </svg>
      {size !== 'sm' && (
        <div>
          <p className="eyebrow">Fit score</p>
          <p className="text-sm font-medium" style={{ color: colour }}>{CATEGORY_LABEL[category]}</p>
        </div>
      )}
    </div>
  );
}

export function CategoryPill({ category }: { category: MatchCategory }) {
  const cls = {
    strong: 'border-evidence-yes/30 text-evidence-yes bg-evidence-yes/5',
    good: 'border-petrol-500/30 text-petrol-700 bg-petrol-50',
    potential: 'border-evidence-partial/30 text-evidence-partial bg-evidence-partial/5',
    low: 'border-rule text-ink-muted bg-wash',
  }[category];
  return (
    <span className={`inline-flex items-center rounded-sharp border px-2 py-0.5 font-mono text-micro uppercase tracking-wider ${cls}`}>
      {CATEGORY_LABEL[category]}
    </span>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center border border-dashed border-rule rounded-sharp px-6 py-14 text-center">
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1.5 max-w-md text-sm text-ink-muted">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="rounded-sharp border border-evidence-no/25 bg-evidence-no/5 px-5 py-4">
      <p className="text-sm font-semibold text-evidence-no">{title}</p>
      <p className="mt-1 text-sm text-ink-soft">{body}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-sharp bg-rule/60 ${className}`} aria-hidden />;
}

export function ProcessingState({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-sharp border border-rule bg-wash px-4 py-3">
      <span className="relative flex h-2 w-2" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-petrol-500 opacity-70" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-petrol-700" />
      </span>
      <p className="text-sm text-ink-soft">{label}</p>
    </div>
  );
}

/** §92 — shown wherever AI output drives a recruiter-facing view. */
export function AiDisclosure({ sources }: { sources?: string }) {
  return (
    <p className="mt-4 border-t border-rule pt-3 text-xs leading-relaxed text-ink-faint">
      Generated from {sources ?? 'the candidate\u2019s resume, profile and this job specification'}.
      These insights support your assessment and should be read alongside the original resume.
      The hiring decision remains yours.
    </p>
  );
}

export function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="border-l-2 border-rule pl-3">
      <p className="eyebrow">{label}</p>
      <p className="tnum mt-0.5 text-2xl font-semibold tracking-tight">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}
