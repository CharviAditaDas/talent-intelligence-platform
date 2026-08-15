import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePage } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { AppShell, PageHead } from '@/components/app-shell';
import { Panel, ImportanceTag } from '@/components/ui';
import { MatchPanel } from './match-panel';

export const dynamic = 'force-dynamic';

export default async function CandidateJobDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePage('candidate');
  const supabase = await createClient();

  const { data: job } = await supabase.from('jobs').select('*').eq('id', id).maybeSingle();
  if (!job) notFound();

  const { data: candidate } = await supabase
    .from('candidate_profiles').select('id').eq('user_id', user.id).single();

  const { data: existing } = await supabase
    .from('applications').select('id, stage').eq('job_id', id)
    .eq('candidate_id', candidate?.id ?? '').maybeSingle();

  const { data: resume } = await supabase
    .from('resumes').select('id, status').eq('is_active', true).maybeSingle();

  const { data: requirements } = await supabase
    .from('job_requirements').select('id, label, importance, detail')
    .eq('job_id', id).order('sort_order');

  const readyToApply = !!resume && resume.status === 'analyzed';

  return (
    <AppShell user={user}>
      <Link href="/candidate/jobs" className="font-mono text-micro uppercase tracking-wider text-ink-faint hover:text-ink">
        &larr; All roles
      </Link>

      <div className="mt-4">
        <PageHead eyebrow={`${job.company} · ${job.location}`} title={job.title} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Panel eyebrow="Role" title="About this role">
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">{job.description}</div>

            {job.responsibilities?.length > 0 && (
              <div className="mt-6">
                <p className="eyebrow mb-2">Responsibilities</p>
                <ul className="space-y-2">
                  {job.responsibilities.map((r: string, i: number) => (
                    <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-ink-soft">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-petrol-500" aria-hidden />{r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Panel>

          {(requirements ?? []).length > 0 && (
            <Panel eyebrow="Specification" title="What this role asks for">
              <div className="border-t border-rule">
                {(requirements ?? []).map((r) => (
                  <div key={r.id} className="flex items-start justify-between gap-4 border-b border-rule py-2.5 last:border-b-0">
                    <div>
                      <p className="text-sm">{r.label}</p>
                      {r.detail && <p className="mt-0.5 text-xs text-ink-faint">{r.detail}</p>}
                    </div>
                    <ImportanceTag importance={r.importance} />
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>

        <MatchPanel
          jobId={job.id}
          jobTitle={job.title}
          isOpen={job.status === 'active'}
          existingApplicationId={existing?.id ?? null}
          hasResume={!!resume}
          resumeReady={readyToApply}
        />
      </div>
    </AppShell>
  );
}
