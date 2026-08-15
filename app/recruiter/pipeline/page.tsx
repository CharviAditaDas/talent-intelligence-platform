import Link from 'next/link';
import { requirePage } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { AppShell, PageHead } from '@/components/app-shell';
import { EmptyState, CategoryPill } from '@/components/ui';
import { STAGE_LABEL } from '@/components/stage-tracker';
import type { MatchCategory } from '@/lib/scoring/engine';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Pipeline' };

const COLUMNS = [
  'ai_screening', 'under_review', 'shortlisted',
  'interview_1', 'interview_2', 'final_evaluation', 'offer',
] as const;

export default async function Pipeline() {
  const user = await requirePage('recruiter', 'admin');
  const supabase = await createClient();

  const { data: apps } = await supabase
    .from('applications')
    .select(`id, stage, jobs(title), candidate_profiles(profiles(full_name)),
             application_scores(overall, category)`)
    .order('submitted_at', { ascending: false });

  const rows = (apps ?? []).map((a) => {
    const cp = a.candidate_profiles as unknown as { profiles: { full_name: string } | null } | null;
    const job = a.jobs as unknown as { title: string } | null;
    const score = a.application_scores as unknown as { overall: number; category: MatchCategory } | null;
    return {
      id: a.id, stage: a.stage,
      name: cp?.profiles?.full_name ?? 'Candidate',
      jobTitle: job?.title ?? '',
      score: score ? Number(score.overall) : null,
      category: score?.category ?? null,
    };
  });

  return (
    <AppShell user={user}>
      <PageHead eyebrow="Pipeline" title="Recruitment pipeline"
                description="Every active application across your roles, by stage. Open a candidate to move them." />

      {rows.length === 0 ? (
        <EmptyState title="Nothing in the pipeline"
                    body="Applications appear here once candidates apply to your roles." />
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4" style={{ minWidth: `${COLUMNS.length * 15}rem` }}>
            {COLUMNS.map((col) => {
              const items = rows.filter((r) => r.stage === col);
              return (
                <div key={col} className="w-60 shrink-0">
                  <div className="mb-2 flex items-center justify-between gap-2 border-b-2 border-ink pb-2">
                    <span className="font-mono text-micro uppercase tracking-wider">{STAGE_LABEL[col]}</span>
                    <span className="tnum text-sm font-semibold">{items.length}</span>
                  </div>
                  <ul className="space-y-2">
                    {items.map((r) => (
                      <li key={r.id}>
                        <Link href={`/recruiter/applications/${r.id}`}
                              className="block panel px-3 py-2.5 hover:border-petrol-500">
                          <p className="text-sm font-medium">{r.name}</p>
                          <p className="mt-0.5 truncate text-xs text-ink-faint">{r.jobTitle}</p>
                          <div className="mt-2 flex items-center justify-between gap-2">
                            {r.category ? <CategoryPill category={r.category} /> : <span />}
                            {r.score != null && (
                              <span className="tnum text-sm font-semibold">{r.score.toFixed(0)}</span>
                            )}
                          </div>
                        </Link>
                      </li>
                    ))}
                    {items.length === 0 && (
                      <li className="rounded-sharp border border-dashed border-rule px-3 py-6 text-center text-xs text-ink-faint">
                        Empty
                      </li>
                    )}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="panel panel-pad">
          <p className="eyebrow mb-2">Hired</p>
          <p className="tnum text-2xl font-semibold">{rows.filter((r) => r.stage === 'hired').length}</p>
        </div>
        <div className="panel panel-pad">
          <p className="eyebrow mb-2">Closed</p>
          <p className="tnum text-2xl font-semibold">{rows.filter((r) => r.stage === 'rejected').length}</p>
        </div>
      </div>
    </AppShell>
  );
}
