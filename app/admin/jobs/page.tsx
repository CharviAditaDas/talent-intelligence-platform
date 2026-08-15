import Link from 'next/link';
import { requirePage } from '@/lib/auth/guards';
import { createAdminClient } from '@/lib/supabase/admin';
import { AppShell, PageHead } from '@/components/app-shell';
import { Panel, EmptyState } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Role oversight' };

export default async function AdminJobs() {
  const user = await requirePage('admin');
  const db = createAdminClient();

  const { data: jobs } = await db
    .from('jobs').select('id, title, company, status, created_at, recruiter_id, profiles!jobs_recruiter_id_fkey(full_name, email)')
    .order('created_at', { ascending: false });

  const { data: apps } = await db.from('applications').select('job_id');
  const counts = new Map<string, number>();
  for (const a of apps ?? []) counts.set(a.job_id, (counts.get(a.job_id) ?? 0) + 1);

  return (
    <AppShell user={user}>
      <PageHead eyebrow="Administration" title="Roles"
                description="Every role on the platform, across all recruiters." />
      <Panel eyebrow={`${(jobs ?? []).length} roles`} title="All roles">
        {(jobs ?? []).length === 0 ? (
          <EmptyState title="No roles" body="Roles created by recruiters appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[42rem]">
              <thead>
                <tr>
                  <th className="th">Role</th><th className="th">Owner</th>
                  <th className="th">Status</th><th className="th text-right">Applicants</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody>
                {(jobs ?? []).map((j) => {
                  const owner = j.profiles as unknown as { full_name: string; email: string } | null;
                  return (
                    <tr key={j.id}>
                      <td className="td">
                        <span className="font-medium">{j.title}</span>
                        <span className="block text-xs text-ink-faint">{j.company}</span>
                      </td>
                      <td className="td text-ink-muted">{owner?.full_name || owner?.email || '—'}</td>
                      <td className="td"><span className="chip">{j.status}</span></td>
                      <td className="td tnum text-right">{counts.get(j.id) ?? 0}</td>
                      <td className="td text-right">
                        <Link href={`/jobs/${j.id}`} className="text-sm text-petrol-700 hover:underline">View</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </AppShell>
  );
}
