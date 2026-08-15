import Link from 'next/link';
import { PublicHeader, PublicFooter } from '@/components/site-header';
import { EvidenceBadge } from '@/components/ui';

/**
 * The hero is the product's thesis made literal: a requirement matrix
 * showing a vague resume phrase being correctly refused rather than
 * upgraded into a confirmed skill. That single row is the argument.
 */
const HERO_ROWS = [
  {
    label: 'Python',
    importance: 'Required',
    state: 'demonstrated' as const,
    evidence: '"Built ETL pipelines in Python (pandas, Airflow) processing 40M rows nightly"',
  },
  {
    label: 'AWS',
    importance: 'Required',
    state: 'not_demonstrated' as const,
    evidence: 'Resume states "worked with cloud technologies" — no AWS service, tool or project named.',
  },
  {
    label: 'Kubernetes',
    importance: 'Preferred',
    state: 'insufficient' as const,
    evidence: '"Deployed containerised services" — containerisation shown, orchestration platform not identified.',
  },
];

const CAPABILITIES = [
  {
    name: 'Resume intelligence',
    body: 'Structured extraction of skills, experience, projects and education from PDF resumes, with an ATS readability assessment that measures machine-parseability rather than candidate quality.',
  },
  {
    name: 'Job-specific matching',
    body: 'There is no universal candidate score. Every candidate is assessed against one job specification at a time, so the same person can be a strong match for one role and a partial match for another.',
  },
  {
    name: 'Candidate screening',
    body: 'Each application is screened automatically on submission. Requirements are resolved to one of three evidence states, each carrying the resume phrase it was drawn from.',
  },
  {
    name: 'Talent intelligence',
    body: 'Requirement coverage, skill gaps and pipeline movement across a role, aggregated from live application data rather than sampled or estimated.',
  },
  {
    name: 'Interview intelligence',
    body: 'Interview kits weighted toward requirements that screening left unresolved, so the conversation is spent on what evidence could not settle.',
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />

      <main id="main" className="flex-1">
        {/* ---------------- Hero ---------------- */}
        <section className="border-b border-rule bg-paper">
          <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 lg:grid-cols-[1.05fr_1fr] lg:py-24">
            <div className="animate-rise">
              <p className="eyebrow">AI resume screening &amp; talent intelligence</p>
              <h1 className="mt-4 text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">
                Every claim about a candidate,
                <span className="text-petrol-700"> traceable to the line it came from.</span>
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-soft">
                Most screening tools infer. This one refuses to. A resume that says
                &ldquo;worked with cloud technologies&rdquo; does not become an AWS
                qualification — it becomes an open question for the interview.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/jobs" className="btn-primary">Explore the platform</Link>
                <Link href="/login" className="btn-secondary">Sign in</Link>
              </div>
              <p className="mt-6 max-w-lg text-xs leading-relaxed text-ink-faint">
                Scores are computed by a fixed, auditable scoring model. The language
                model supplies evidence states and explanation; it never produces the
                number, and it never makes the decision.
              </p>
            </div>

            {/* Signature element */}
            <div className="animate-rise">
              <div className="panel shadow-panel">
                <header className="flex items-center justify-between border-b border-rule px-5 py-3">
                  <p className="eyebrow">Requirement matrix — extract</p>
                  <p className="font-mono text-micro text-ink-faint">SENIOR DATA ENGINEER</p>
                </header>
                <div className="px-5 py-2">
                  {HERO_ROWS.map((row) => (
                    <div key={row.label} className={`ledger-row rail-${row.state}`}>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                          <span className="text-sm font-semibold">{row.label}</span>
                          <span className="font-mono text-micro uppercase tracking-wider text-ink-faint">
                            {row.importance}
                          </span>
                        </div>
                        <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">{row.evidence}</p>
                      </div>
                      <div className="shrink-0 pt-0.5">
                        <EvidenceBadge state={row.state} />
                      </div>
                    </div>
                  ))}
                </div>
                <footer className="border-t border-rule bg-wash px-5 py-3">
                  <p className="text-xs text-ink-muted">
                    An unmet requirement never auto-rejects a candidate. It is surfaced,
                    ranked and left to the recruiter.
                  </p>
                </footer>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------- Capabilities ---------------- */}
        <section className="mx-auto max-w-6xl px-5 py-16">
          <p className="eyebrow">Core capabilities</p>
          <div className="mt-8 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {CAPABILITIES.map((c) => (
              <article key={c.name} className="border-t-2 border-ink pt-4">
                <h3 className="text-sm font-semibold tracking-tight">{c.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{c.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ---------------- How assessment works ---------------- */}
        <section className="border-y border-rule bg-paper">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <p className="eyebrow">How an assessment is produced</p>
            <h2 className="mt-3 max-w-2xl text-2xl font-semibold tracking-tight">
              The model reads. Arithmetic scores. A person decides.
            </h2>
            {/* Numbered here because this genuinely is an ordered pipeline. */}
            <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ['01', 'Specification', 'A job posting is converted into discrete, individually assessable requirements, each marked required, preferred or nice-to-have.'],
                ['02', 'Evidence', 'The resume is assessed against each requirement and resolved to demonstrated, insufficient, or not demonstrated — with the supporting phrase attached.'],
                ['03', 'Scoring', 'Evidence states are weighted by importance and role-specific dimension weights, then scored by fixed arithmetic. Same input, same number, every time.'],
                ['04', 'Decision', 'The recruiter reviews the matrix beside the original PDF and sets the outcome. Their decision is recorded separately and never overwrites the assessment.'],
              ].map(([n, title, body]) => (
                <li key={n}>
                  <p className="font-mono text-micro tracking-[0.2em] text-petrol-500">{n}</p>
                  <h3 className="mt-2 text-sm font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-muted">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---------------- Close ---------------- */}
        <section className="mx-auto max-w-6xl px-5 py-16">
          <div className="panel panel-pad flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Browse open roles</h2>
              <p className="mt-1 text-sm text-ink-muted">
                The job board is public. Sign in to see how your resume maps to a specific role.
              </p>
            </div>
            <Link href="/jobs" className="btn-primary shrink-0">View open roles</Link>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
