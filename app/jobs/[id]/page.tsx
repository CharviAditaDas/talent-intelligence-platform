import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/auth/guards';
import { PublicHeader, PublicFooter } from '@/components/site-header';
import { ImportanceTag } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function JobDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getSessionUser();

  const { data: job } = await supabase.from('jobs').select('*').eq('id', id).maybeSingle();
  if (!job) notFound();

  const { data: requirements } = await supabase
    .from('job_requirements')
    .select('id, label, kind, importance, detail')
    .eq('job_id', id)
    .order('sort_order');

  const grouped = {
    required: (requirements ?? []).filter((r) => r.importance === 'required'),
    preferred: (requirements ?? []).filter((r) => r.importance === 'preferred'),
    nice_to_have: (requirements ?? []).filter((r) => r.importance === 'nice_to_have'),
  };

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-5 py-12">
        <Link href="/jobs" className="font-mono text-micro uppercase tracking-wider text-ink-faint hover:text-ink">
          &larr; All open roles
        </Link>

        <header className="mt-5 border-b border-rule pb-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip">{String(job.employment_type).replace(/_/g, ' ')}</span>
            {job.status !== 'active' && <span className="chip">Closed to new applications</span>}
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">{job.title}</h1>
          <p className="mt-2 text-sm text-ink-muted">{job.company} &middot; {job.location}</p>

          <div className="mt-6 flex flex-wrap gap-3">
            {job.status === 'active' ? (
              user
                ? <Link href={`/candidate/jobs/${job.id}`} className="btn-primary">View my match &amp; apply</Link>
                : <Link href="/login" className="btn-primary">Sign in to see your match</Link>
            ) : (
              <span className="text-sm text-ink-muted">This role is no longer accepting applications.</span>
            )}
          </div>
        </header>

        <section className="mt-8">
          <p className="eyebrow">About the role</p>
          <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">
            {job.description}
          </div>
        </section>

        {job.responsibilities?.length > 0 && (
          <section className="mt-8">
            <p className="eyebrow">Responsibilities</p>
            <ul className="mt-3 space-y-2">
              {job.responsibilities.map((r: string, i: number) => (
                <li key={i} className="flex gap-3 text-sm leading-relaxed text-ink-soft">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-petrol-500" aria-hidden />
                  {r}
                </li>
              ))}
            </ul>
          </section>
        )}

        {(requirements ?? []).length > 0 && (
          <section className="mt-8">
            <p className="eyebrow">Requirements</p>
            <div className="mt-3 panel">
              {(['required', 'preferred', 'nice_to_have'] as const).map((band) =>
                grouped[band].length === 0 ? null : (
                  <div key={band} className="border-b border-rule px-5 py-4 last:border-b-0">
                    <ImportanceTag importance={band} />
                    <ul className="mt-2 space-y-1.5">
                      {grouped[band].map((r) => (
                        <li key={r.id} className="text-sm text-ink-soft">
                          {r.label}
                          {r.detail && <span className="text-ink-faint"> — {r.detail}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                ),
              )}
            </div>
          </section>
        )}

        {job.preferred_quals?.length > 0 && (
          <section className="mt-8">
            <p className="eyebrow">Preferred qualifications</p>
            <ul className="mt-3 space-y-2">
              {job.preferred_quals.map((r: string, i: number) => (
                <li key={i} className="text-sm leading-relaxed text-ink-soft">{r}</li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}
