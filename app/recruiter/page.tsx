import Link from 'next/link';
import { requirePage } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { AppShell, PageHead } from '@/components/app-shell';
import { Panel, Stat, EmptyState, CategoryPill } from '@/components/ui';
import type { MatchCategory } from '@/lib/scoring/engine';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Recruiter overview' };

const FUNNEL: Array<[string, string]> = [
  ['submitted', 'Submitted'], ['ai_screening', 'Screened'], ['under_review', 'Under review'],
  ['shortlisted', 'Shortlisted'], ['interview_1', 'Interview 1'], ['interview_2', 'Interview 2'],
  ['final_evaluation', 'Final'], ['offer', 'Offer'], ['hired', 'Hired'], ['rejected', 'Rejected'],
];

export default async function RecruiterOverview() {
  const user = await requirePage('recruiter', 'admin');
  const supabase = await createClient();

  // RLS scopes every one of these to jobs this recruiter owns.
  const { data: jobs } = await supabase
    .from('jobs').select('id, title, company, status').order('created_at', { ascending: false });

  const { data: apps } = await supabase
    .from('applications')
    .select('id, stage, screening_status, submitted_at, job_id, jobs(title), application_scores(overall, category)');

  const applications = apps ?? [];
  const activeJobs = (jobs ?? []).filter((j) => j.status === 'active');

  const stageCounts = FUNNEL.map(([key, label]) => ({
    key, label, count: applications.filter((a) => a.stage === key).length,
  }));

  const scored = applications
    .map((a) => a.application_scores as unknown as { overall: number; category: MatchCategory } | null)
    .filter((s): s is { overall: number; category: MatchCategory } => !!s);

  const avgFit = scored.length
    ? (scored.reduce((sum, s) => sum + Number(s.overall), 0) / scored.length).toFixed(1)
    : '—';

  const distribution = (['strong', 'good', 'potential', 'low'] as const).map((c) => ({
    category: c, count: scored.filter((s) => s.category === c).length,
  }));

  const maxStage = Math.max(1, ...stageCounts.map((s) => s.count));

  return (
    <AppShell user={user}>
      <PageHead
        eyebrow="Recruiter workspace"
        title="Hiring overview"
        description="Live figures across the roles you own. Every number is computed from application data, not sampled."
        action={<Link href="/recruiter/jobs/new" className="btn-primary">Create a role</Link>}
      />

      <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
        <Stat label="Active roles" value={activeJobs.length} hint={`${(jobs ?? []).length} total`} />
        <Stat label="Applications" value={applications.length} />
        <Stat label="Average fit" value={avgFit} hint="Across screened applicants" />
        <Stat label="Awaiting review" value={applications.filter((a) => a.stage === 'ai_screening').length} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel eyebrow="Recruitment funnel" title="Pipeline by stage" className="lg:col-span-2">
          {applications.length === 0 ? (
            <EmptyState title="No applications yet"
                        body="Once a role is active and candidates apply, the funnel fills in here automatically." />
          ) : (
            <ul className="space-y-2.5">
              {stageCounts.map((s) => (
                <li key={s.key} className="grid grid-cols-[9rem_1fr_2.5rem] items-center gap-3">
                  <span className="font-mono text-micro uppercase tracking-wider text-ink-muted">{s.label}</span>
                  <div className="h-4 w-full bg-wash">
                    <div className="h-full bg-petrol-700 transition-all"
                         style={{ width: `${(s.count / maxStage) * 100}%` }} />
                  </div>
                  <span className="tnum text-right text-sm font-medium">{s.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel eyebrow="Talent intelligence" title="Match distribution">
          {scored.length === 0 ? (
            <p className="text-sm text-ink-muted">No screened applicants yet.</p>
          ) : (
            <ul className="space-y-3">
              {distribution.map((d) => (
                <li key={d.category} className="flex items-center justify-between gap-3">
                  <CategoryPill category={d.category} />
                  <span className="tnum text-sm font-medium">{d.count}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-5 border-t border-rule pt-3 text-xs leading-relaxed text-ink-faint">
            Match categories group applicants for review. They never trigger an
            automatic outcome.
          </p>
        </Panel>
      </div>

      <Panel eyebrow="Your roles" title="Roles" className="mt-6"
             action={<Link href="/recruiter/jobs" className="btn-ghost text-sm">Manage roles</Link>}>
        {(jobs ?? []).length === 0 ? (
          <EmptyState title="No roles yet"
                      body="Create a role and the platform will convert your description into an assessable specification."
                      action={<Link href="/recruiter/jobs/new" className="btn-primary">Create a role</Link>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem]">
              <thead>
                <tr><th className="th">Role</th><th className="th">Status</th>
                    <th className="th text-right">Applicants</th><th className="th" /></tr>
              </thead>
              <tbody>
                {(jobs ?? []).map((j) => (
                  <tr key={j.id}>
                    <td className="td font-medium">{j.title}<span className="block text-xs text-ink-faint">{j.company}</span></td>
                    <td className="td"><span className="chip">{j.status}</span></td>
                    <td className="td tnum text-right">{applications.filter((a) => a.job_id === j.id).length}</td>
                    <td className="td text-right">
                      <Link href={`/recruiter/jobs/${j.id}`} className="text-sm text-petrol-700 hover:underline">Open</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </AppShell>
  );
}
