import Link from 'next/link';
import { requirePage } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { AppShell, PageHead } from '@/components/app-shell';
import { EmptyState } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Roles' };

export default async function CandidateJobs() {
  const user = await requirePage('candidate');
  const supabase = await createClient();

  const { data: jobs } = await supabase
    .from('jobs').select('id, title, company, location, employment_type')
    .eq('status', 'active').order('published_at', { ascending: false });

  const { data: applied } = await supabase.from('applications').select('job_id');
  const appliedIds = new Set((applied ?? []).map((a) => a.job_id));

  return (
    <AppShell user={user}>
      <PageHead eyebrow="Roles" title="Open roles"
                description="Open a role to see how your resume maps to it before you apply." />

      {(jobs ?? []).length === 0 ? (
        <EmptyState title="No open roles" body="Nothing is accepting applications right now. Check back shortly." />
      ) : (
        <ul className="border-t border-rule">
          {(jobs ?? []).map((j) => (
            <li key={j.id}>
              <Link href={`/candidate/jobs/${j.id}`}
                    className="group flex flex-col gap-2 border-b border-rule py-5 hover:bg-paper sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold tracking-tight group-hover:text-petrol-700">{j.title}</h2>
                  <p className="mt-1 text-sm text-ink-muted">{j.company} &middot; {j.location}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="chip">{String(j.employment_type).replace(/_/g, ' ')}</span>
                  {appliedIds.has(j.id) && (
                    <span className="font-mono text-micro uppercase tracking-wider text-evidence-yes">Applied</span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
