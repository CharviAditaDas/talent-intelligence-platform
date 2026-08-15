import Link from 'next/link';
import { requirePage } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { AppShell, PageHead } from '@/components/app-shell';
import { EmptyState, CategoryPill } from '@/components/ui';
import { STAGE_LABEL } from '@/components/stage-tracker';
import type { MatchCategory } from '@/lib/scoring/engine';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Applications' };

export default async function CandidateApplications() {
  const user = await requirePage('candidate');
  const supabase = await createClient();

  const { data: apps } = await supabase
    .from('applications')
    .select('id, stage, screening_status, submitted_at, jobs(title, company), application_scores(category)')
    .order('submitted_at', { ascending: false });

  return (
    <AppShell user={user}>
      <PageHead eyebrow="Applications" title="Your applications"
                description="Each application is assessed against its own role. A strong match for one role can be a partial match for another." />

      {(apps ?? []).length === 0 ? (
        <EmptyState title="No applications yet"
                    body="Browse open roles and check your match before applying."
                    action={<Link href="/candidate/jobs" className="btn-primary">Browse roles</Link>} />
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full min-w-[42rem]">
            <thead>
              <tr>
                <th className="th">Role</th><th className="th">Applied</th>
                <th className="th">Stage</th><th className="th">Your match</th><th className="th" />
              </tr>
            </thead>
            <tbody>
              {(apps ?? []).map((a) => {
                const job = a.jobs as unknown as { title: string; company: string } | null;
                const score = a.application_scores as unknown as { category: MatchCategory } | null;
                return (
                  <tr key={a.id}>
                    <td className="td">
                      <span className="font-medium">{job?.title}</span>
                      <span className="block text-xs text-ink-faint">{job?.company}</span>
                    </td>
                    <td className="td tnum text-ink-muted">
                      {new Date(a.submitted_at).toLocaleDateString()}
                    </td>
                    <td className="td">{STAGE_LABEL[a.stage] ?? a.stage}</td>
                    <td className="td">
                      {score ? <CategoryPill category={score.category} />
                             : <span className="text-xs text-ink-faint">Screening</span>}
                    </td>
                    <td className="td text-right">
                      <Link href={`/candidate/applications/${a.id}`}
                            className="text-sm text-petrol-700 hover:underline">Open</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
