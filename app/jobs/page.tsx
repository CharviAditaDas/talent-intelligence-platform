import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PublicHeader, PublicFooter } from '@/components/site-header';
import { EmptyState } from '@/components/ui';

export const metadata = { title: 'Open roles' };
export const dynamic = 'force-dynamic';

/**
 * Public job board (§18). No authentication required.
 * RLS policy `jobs_public_read` limits anonymous reads to status = 'active',
 * so a closed job cannot leak here even if this query forgot to filter.
 */
export default async function JobsPage() {
  const supabase = await createClient();
  const { data: jobs, error } = await supabase
    .from('jobs')
    .select('id, title, company, location, employment_type, published_at, status')
    .eq('status', 'active')
    .order('published_at', { ascending: false });

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-5 py-12">
        <p className="eyebrow">Open roles</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Roles accepting applications</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted">
          Browse without an account. Sign in to see how your resume maps to a
          specific role before you apply.
        </p>

        <div className="mt-10">
          {error && (
            <p className="rounded-sharp border border-evidence-no/25 bg-evidence-no/5 px-4 py-3 text-sm text-evidence-no">
              Open roles could not be loaded. Refresh to try again.
            </p>
          )}

          {!error && (!jobs || jobs.length === 0) && (
            <EmptyState
              title="No roles are open right now"
              body="Closed roles are archived rather than listed. Check back, or sign in to review roles you have already applied to."
            />
          )}

          {jobs && jobs.length > 0 && (
            <ul className="border-t border-rule">
              {jobs.map((job) => (
                <li key={job.id}>
                  <Link href={`/jobs/${job.id}`}
                        className="group flex flex-col gap-2 border-b border-rule py-5 transition-colors hover:bg-paper sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <h2 className="text-base font-semibold tracking-tight group-hover:text-petrol-700">
                        {job.title}
                      </h2>
                      <p className="mt-1 text-sm text-ink-muted">
                        {job.company} &middot; {job.location}
                      </p>
                    </div>
                    <span className="chip shrink-0">
                      {String(job.employment_type).replace(/_/g, ' ')}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
