import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePage } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { AppShell, PageHead } from '@/components/app-shell';
import { PrepWorkspace } from './prep-workspace';

export const dynamic = 'force-dynamic';

export default async function InterviewPrepPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const user = await requirePage('candidate');
  const supabase = await createClient();

  const { data: job } = await supabase.from('jobs').select('id, title, company').eq('id', jobId).maybeSingle();
  if (!job) notFound();

  const { data: candidate } = await supabase
    .from('candidate_profiles').select('id').eq('user_id', user.id).single();

  const { data: prep } = await supabase
    .from('interview_preps').select('id, questions')
    .eq('job_id', jobId).eq('candidate_id', candidate?.id ?? '').maybeSingle();

  return (
    <AppShell user={user}>
      <Link href="/candidate/interview" className="font-mono text-micro uppercase tracking-wider text-ink-faint hover:text-ink">
        &larr; Interview preparation
      </Link>
      <div className="mt-4">
        <PageHead eyebrow={job.company} title={`Prepare: ${job.title}`}
                  description="Answer a question and get specific feedback on what you actually said." />
      </div>
      <PrepWorkspace
        jobId={job.id}
        jobTitle={job.title}
        prepId={prep?.id ?? null}
        initialQuestions={(prep?.questions as never) ?? null}
      />
    </AppShell>
  );
}
