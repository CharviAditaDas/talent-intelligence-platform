import { requirePage } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { AppShell, PageHead } from '@/components/app-shell';
import { ResumeWorkspace } from './resume-workspace';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Resume' };

export default async function ResumePage() {
  const user = await requirePage('candidate');
  const supabase = await createClient();

  const { data: candidate } = await supabase
    .from('candidate_profiles').select('id').eq('user_id', user.id).single();

  const { data: resume } = await supabase
    .from('resumes')
    .select('id, file_name, file_size, page_count, status, extraction_error, created_at, extracted_text')
    .eq('is_active', true).maybeSingle();

  const { data: analysis } = resume
    ? await supabase.from('resume_analyses')
        .select('ats_score, ats, sections, extracted, strengths, improvements, created_at')
        .eq('resume_id', resume.id).maybeSingle()
    : { data: null };

  return (
    <AppShell user={user}>
      <PageHead
        eyebrow="Resume"
        title="Your resume"
        description="One active resume at a time. Replacing it re-runs the analysis and becomes the resume used for new applications."
      />
      <ResumeWorkspace
        resume={resume ? {
          id: resume.id, fileName: resume.file_name, fileSize: resume.file_size,
          pageCount: resume.page_count, status: resume.status,
          extractionError: resume.extraction_error, createdAt: resume.created_at,
          excerpt: (resume.extracted_text ?? '').slice(0, 4000),
        } : null}
        analysis={analysis as never}
        hasProfile={!!candidate}
      />
    </AppShell>
  );
}
