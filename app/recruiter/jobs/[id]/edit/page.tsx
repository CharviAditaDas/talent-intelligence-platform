import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePage, requireJobOwnership } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { AppShell, PageHead } from '@/components/app-shell';
import { JobForm, type JobValues } from '../../job-form';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Edit role' };

export default async function EditJob({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePage('recruiter', 'admin');
  await requireJobOwnership(id);
  const supabase = await createClient();

  const { data: job } = await supabase.from('jobs').select('*').eq('id', id).maybeSingle();
  if (!job) notFound();

  const initial: JobValues = {
    title: job.title, company: job.company, location: job.location,
    employmentType: job.employment_type, description: job.description,
    responsibilities: job.responsibilities ?? [], preferredQuals: job.preferred_quals ?? [],
    niceToHave: job.nice_to_have ?? [], experienceMin: job.experience_min,
    experienceMax: job.experience_max, educationLevel: job.education_level ?? '',
    status: job.status,
  };

  return (
    <AppShell user={user}>
      <Link href={`/recruiter/jobs/${id}`} className="font-mono text-micro uppercase tracking-wider text-ink-faint hover:text-ink">
        &larr; {job.title}
      </Link>
      <div className="mt-4">
        <PageHead eyebrow="Edit role" title={job.title}
                  description="Changing the description or requirements re-derives the specification. Applications already submitted keep the specification they were assessed against." />
      </div>
      <JobForm mode="edit" jobId={id} initial={initial} />
    </AppShell>
  );
}
