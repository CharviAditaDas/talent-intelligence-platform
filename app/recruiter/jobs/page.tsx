import Link from 'next/link';
import { requirePage } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { AppShell, PageHead } from '@/components/app-shell';
import { EmptyState } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Roles' };

export default async function RecruiterJobs() {
  const user = await requirePage('recruiter', 'admin');
  const supabase = await createClient();

  const { data: jobs } = await supabase
    .from('jobs').select('id, title, company, location, status, created_at, spec_version')
    .order('created_at', { ascending: false });

  const { data: apps } = await supabase.from('applications').select('job_id');
  const counts = new Map<string, number>();
  for (const a of apps ?? []) counts.set(a.job_id, (counts.get(a.job_id) ?? 0) + 1);

  return (
    <AppShell user={user}>
      <PageHead eyebrow="Roles" title="Your roles"
                description="Roles stay editable after applications arrive. Existing assessments are unaffected because each was run against the specification captured at submission."
                action={<Link href="/recruiter/jobs/new" className="btn-primary">Create a role</Link>} />

      {(jobs ?? []).length === 0 ? (
        <EmptyState title="No roles yet"
                    body="Create a role and its description is converted into an assessable specification automatically."
                    action={<Link href="/recruiter/jobs/new" className="btn-primary">Create a role</Link>} />
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full min-w-[44rem]">
            <thead>
              <tr>
                <th className="th">Role</th><th className="th">Location</th><th className="th">Status</th>
                <th className="th text-right">Applicants</th><th className="th" />
              </tr>
            </thead>
            <tbody>
              {(jobs ?? []).map((j) => (
                <tr key={j.id}>
                  <td className="td">
                    <span className="font-medium">{j.title}</span>
                    <span className="block text-xs text-ink-faint">{j.company}</span>
                  </td>
                  <td className="td text-ink-muted">{j.location}</td>
                  <td className="td"><span className="chip">{j.status}</span></td>
                  <td className="td tnum text-right">{counts.get(j.id) ?? 0}</td>
                  <td className="td text-right">
                    <Link href={`/recruiter/jobs/${j.id}`} className="text-sm text-petrol-700 hover:underline">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
