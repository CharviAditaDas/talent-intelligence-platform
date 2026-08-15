import Link from 'next/link';
import { requirePage } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { AppShell, PageHead } from '@/components/app-shell';
import { Panel, EmptyState } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Interview preparation' };

export default async function InterviewIndex() {
  const user = await requirePage('candidate');
  const supabase = await createClient();

  const { data: apps } = await supabase
    .from('applications').select('id, job_id, jobs(title, company)')
    .order('submitted_at', { ascending: false });

  const { data: preps } = await supabase.from('interview_preps').select('job_id');
  const prepared = new Set((preps ?? []).map((p) => p.job_id));

  const { data: practice } = await supabase
    .from('interview_practice').select('id, question, created_at')
    .order('created_at', { ascending: false }).limit(5);

  return (
    <AppShell user={user}>
      <PageHead eyebrow="Interview preparation" title="Prepare for your interviews"
                description="Questions are grounded in your resume and the specific role — not generic lists." />

      {(apps ?? []).length === 0 ? (
        <EmptyState title="Nothing to prepare for yet"
                    body="Apply to a role and preparation becomes available here."
                    action={<Link href="/candidate/jobs" className="btn-primary">Browse roles</Link>} />
      ) : (
        <Panel eyebrow="Your roles" title="Choose a role">
          <ul className="divide-y divide-rule">
            {(apps ?? []).map((a) => {
              const job = a.jobs as unknown as { title: string; company: string } | null;
              return (
                <li key={a.id} className="flex items-center justify-between gap-4 py-3.5">
                  <div>
                    <p className="text-sm font-medium">{job?.title}</p>
                    <p className="text-xs text-ink-faint">{job?.company}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {prepared.has(a.job_id) && (
                      <span className="font-mono text-micro uppercase tracking-wider text-evidence-yes">Ready</span>
                    )}
                    <Link href={`/candidate/interview/${a.job_id}`} className="btn-secondary text-sm">
                      {prepared.has(a.job_id) ? 'Open' : 'Generate'}
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}

      {(practice ?? []).length > 0 && (
        <Panel eyebrow="History" title="Recent practice" className="mt-6">
          <ul className="divide-y divide-rule">
            {(practice ?? []).map((p) => (
              <li key={p.id} className="py-3">
                <p className="text-sm text-ink-soft">{p.question}</p>
                <p className="mt-0.5 tnum text-xs text-ink-faint">
                  {new Date(p.created_at).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </AppShell>
  );
}
