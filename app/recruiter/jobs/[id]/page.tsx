import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePage, requireJobOwnership } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { AppShell, PageHead } from '@/components/app-shell';
import { Panel, EmptyState, ImportanceTag, Stat } from '@/components/ui';
import { RankingTable, type Row } from './ranking-table';
import { JobActions } from './job-actions';
import type { MatchCategory } from '@/lib/scoring/engine';

export const dynamic = 'force-dynamic';

export default async function JobWorkspace({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePage('recruiter', 'admin');
  await requireJobOwnership(id);
  const supabase = await createClient();

  const { data: job } = await supabase.from('jobs').select('*').eq('id', id).maybeSingle();
  if (!job) notFound();

  const { data: requirements } = await supabase
    .from('job_requirements').select('id, label, kind, importance, detail')
    .eq('job_id', id).order('sort_order');

  const { data: analysis } = await supabase
    .from('job_analyses').select('weights, rationale, model, created_at')
    .eq('job_id', id).order('spec_version', { ascending: false }).limit(1).maybeSingle();

  const { data: apps } = await supabase
    .from('applications')
    .select(`id, stage, screening_status, submitted_at,
             candidate_profiles(location, years_experience, profiles(full_name, email)),
             application_scores(overall, category),
             application_analyses(skill_intelligence, requirement_matrix)`)
    .eq('job_id', id);

  const rows: Row[] = (apps ?? []).map((a) => {
    const cp = a.candidate_profiles as unknown as {
      location: string | null; years_experience: number | null;
      profiles: { full_name: string; email: string } | null;
    } | null;
    const score = a.application_scores as unknown as { overall: number; category: MatchCategory } | null;
    const an = a.application_analyses as unknown as {
      skill_intelligence: { matching: string[]; missing: string[] };
      requirement_matrix: Array<{ importance: string; state: string }>;
    } | null;
    const matrix = an?.requirement_matrix ?? [];
    return {
      id: a.id,
      name: cp?.profiles?.full_name ?? 'Candidate',
      email: cp?.profiles?.email ?? '',
      location: cp?.location ?? '',
      years: cp?.years_experience ?? null,
      score: score ? Number(score.overall) : null,
      category: score?.category ?? null,
      stage: a.stage,
      screeningStatus: a.screening_status,
      submittedAt: a.submitted_at,
      matchingSkills: an?.skill_intelligence?.matching ?? [],
      missingSkills: an?.skill_intelligence?.missing ?? [],
      requiredUnmet: matrix.filter((m) => m.importance === 'required' && m.state !== 'demonstrated').length,
    };
  });

  const screened = rows.filter((r) => r.score != null);
  const avg = screened.length
    ? (screened.reduce((s, r) => s + (r.score ?? 0), 0) / screened.length).toFixed(1) : '—';

  const weights = (analysis?.weights ?? null) as Record<string, number> | null;

  return (
    <AppShell user={user}>
      <Link href="/recruiter/jobs" className="font-mono text-micro uppercase tracking-wider text-ink-faint hover:text-ink">
        &larr; Roles
      </Link>

      <div className="mt-4">
        <PageHead
          eyebrow={`${job.company} · ${job.location} · ${job.status}`}
          title={job.title}
          action={<JobActions jobId={job.id} status={job.status} />}
        />
      </div>

      <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
        <Stat label="Applicants" value={rows.length} />
        <Stat label="Screened" value={screened.length} />
        <Stat label="Average fit" value={avg} />
        <Stat label="Shortlisted" value={rows.filter((r) => r.stage === 'shortlisted').length} />
      </div>

      <div className="mt-6">
        <Panel eyebrow="Ranking" title="Applicants"
               action={
                 <a href={`/api/export/job/${job.id}`} className="btn-secondary text-sm" download>
                   Export CSV
                 </a>
               }>
          {rows.length === 0 ? (
            <EmptyState title="No applications yet"
                        body={job.status === 'active'
                          ? 'This role is live on the public board. Applicants will appear here with their assessment as they apply.'
                          : 'Publish this role to open it to applications.'} />
          ) : (
            <RankingTable rows={rows} jobId={job.id} />
          )}
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel eyebrow="Specification" title="Derived requirements">
          {(requirements ?? []).length === 0 ? (
            <p className="text-sm text-ink-muted">
              The specification has not been derived yet. It runs automatically after a role is
              created or its description changes.
            </p>
          ) : (
            <div className="border-t border-rule">
              {(requirements ?? []).map((r) => (
                <div key={r.id} className="flex items-start justify-between gap-4 border-b border-rule py-2.5 last:border-b-0">
                  <div className="min-w-0">
                    <p className="text-sm">{r.label}</p>
                    {r.detail && <p className="mt-0.5 text-xs text-ink-faint">{r.detail}</p>}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <ImportanceTag importance={r.importance} />
                    <span className="font-mono text-micro uppercase tracking-wider text-ink-faint">{r.kind}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel eyebrow="Scoring model" title="How this role is weighted">
          {!weights ? (
            <p className="text-sm text-ink-muted">Weights are derived alongside the specification.</p>
          ) : (
            <>
              <ul className="space-y-2.5">
                {Object.entries(weights).map(([dim, w]) => (
                  <li key={dim} className="grid grid-cols-[9rem_1fr_3rem] items-center gap-3">
                    <span className="font-mono text-micro uppercase tracking-wider text-ink-muted">
                      {dim.replace(/_/g, ' ')}
                    </span>
                    <div className="h-3 w-full bg-wash">
                      <div className="h-full bg-petrol-700" style={{ width: `${w * 100 * 2.2}%` }} />
                    </div>
                    <span className="tnum text-right text-xs">{(w * 100).toFixed(1)}%</span>
                  </li>
                ))}
              </ul>
              {analysis?.rationale && (
                <p className="mt-4 border-t border-rule pt-3 text-sm leading-relaxed text-ink-muted">
                  {analysis.rationale}
                </p>
              )}
              <p className="mt-3 text-xs leading-relaxed text-ink-faint">
                Weights are proposed per role, then clamped to bounds and renormalised.
                The score itself is computed by fixed arithmetic, not by the model.
              </p>
            </>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
