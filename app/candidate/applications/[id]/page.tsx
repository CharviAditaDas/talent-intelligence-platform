import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePage } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { AppShell, PageHead } from '@/components/app-shell';
import { Panel, CategoryPill, EvidenceBadge, ProcessingState, AiDisclosure, ErrorState } from '@/components/ui';
import { StageTracker } from '@/components/stage-tracker';
import type { MatchCategory } from '@/lib/scoring/engine';

export const dynamic = 'force-dynamic';

export default async function CandidateApplicationDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePage('candidate');
  const supabase = await createClient();

  // RLS restricts this to the signed-in candidate's own applications.
  const { data: app } = await supabase
    .from('applications')
    .select(`id, stage, screening_status, submitted_at, job_id,
             jobs(title, company, location),
             application_scores(overall, category),
             application_analyses(requirement_matrix, strengths, summary)`)
    .eq('id', id).maybeSingle();

  if (!app) notFound();

  const job = app.jobs as unknown as { title: string; company: string; location: string } | null;
  const score = app.application_scores as unknown as { overall: number; category: MatchCategory } | null;
  const analysis = app.application_analyses as unknown as {
    requirement_matrix: Array<{ label: string; importance: string; state: 'demonstrated' | 'insufficient' | 'not_demonstrated' }>;
    strengths: string[]; summary: string | null;
  } | null;

  return (
    <AppShell user={user}>
      <Link href="/candidate/applications" className="font-mono text-micro uppercase tracking-wider text-ink-faint hover:text-ink">
        &larr; All applications
      </Link>

      <div className="mt-4">
        <PageHead eyebrow={`${job?.company} · ${job?.location}`} title={job?.title ?? 'Application'}
                  description={`Applied ${new Date(app.submitted_at).toLocaleDateString()}`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <Panel eyebrow="Progress" title="Where you are">
          <StageTracker stage={app.stage} />
        </Panel>

        <div className="space-y-6">
          {app.screening_status === 'failed' && (
            <ErrorState
              title="Screening could not be completed"
              body="The hiring team has been notified and your application is unaffected. It remains in their workflow."
            />
          )}

          {(app.screening_status === 'queued' || app.screening_status === 'processing') && (
            <Panel eyebrow="Assessment" title="Screening in progress">
              <ProcessingState label="Your application is being assessed against this role." />
            </Panel>
          )}

          {score && analysis && (
            <>
              <Panel eyebrow="Assessment" title="Your match for this role">
                <div className="flex items-center gap-4">
                  <CategoryPill category={score.category} />
                  <p className="text-sm text-ink-muted">
                    Assessed against this role only.
                  </p>
                </div>
                {analysis.summary && (
                  <p className="mt-4 text-sm leading-relaxed text-ink-soft">{analysis.summary}</p>
                )}
                <AiDisclosure sources="your resume and this role's published requirements" />
              </Panel>

              <Panel eyebrow="Requirement coverage" title="What your resume evidenced">
                <div className="border-t border-rule">
                  {analysis.requirement_matrix.map((m, i) => (
                    <div key={i} className={`ledger-row rail-${m.state}`}>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{m.label}</p>
                        <p className="mt-0.5 font-mono text-micro uppercase tracking-wider text-ink-faint">
                          {String(m.importance).replace(/_/g, ' ')}
                        </p>
                      </div>
                      <div className="shrink-0"><EvidenceBadge state={m.state} /></div>
                    </div>
                  ))}
                </div>
                <p className="mt-4 border-t border-rule pt-3 text-xs leading-relaxed text-ink-faint">
                  An unmet requirement does not close an application. These are read alongside
                  your full resume by the hiring team.
                </p>
              </Panel>
            </>
          )}

          <Panel eyebrow="Prepare" title="Interview preparation">
            <p className="text-sm text-ink-soft">
              Generate practice questions grounded in your resume and this role.
            </p>
            <Link href={`/candidate/interview/${app.job_id}`} className="btn-secondary mt-4">
              Prepare for this role
            </Link>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
