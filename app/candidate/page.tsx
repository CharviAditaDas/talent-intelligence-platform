import Link from 'next/link';
import { requirePage } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { AppShell, PageHead } from '@/components/app-shell';
import { Panel, Stat, EmptyState, ScoreDial, CategoryPill, ProcessingState } from '@/components/ui';
import type { MatchCategory } from '@/lib/scoring/engine';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Overview' };

const STAGE_LABEL: Record<string, string> = {
  submitted: 'Submitted', ai_screening: 'Screening complete', under_review: 'Under review',
  shortlisted: 'Shortlisted', interview_1: 'First interview', interview_2: 'Second interview',
  final_evaluation: 'Final evaluation', offer: 'Offer', hired: 'Hired', rejected: 'Not progressing',
};

export default async function CandidateOverview() {
  const user = await requirePage('candidate');
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from('candidate_profiles').select('id, completeness, summary, location').eq('user_id', user.id).single();

  const { data: resume } = await supabase
    .from('resumes').select('id, file_name, status, created_at')
    .eq('is_active', true).maybeSingle();

  const { data: analysis } = resume
    ? await supabase.from('resume_analyses').select('ats_score, improvements').eq('resume_id', resume.id).maybeSingle()
    : { data: null };

  const { data: applications } = await supabase
    .from('applications')
    .select('id, stage, screening_status, submitted_at, jobs(title, company), application_scores(overall, category)')
    .order('submitted_at', { ascending: false })
    .limit(5);

  const apps = applications ?? [];

  return (
    <AppShell user={user}>
      <PageHead
        eyebrow="Candidate workspace"
        title={user.fullName ? `Welcome back, ${user.fullName.split(' ')[0]}` : 'Your workspace'}
        description="Your resume, your assessments, and the roles you have applied to."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel eyebrow="Resume health" title="Active resume" className="lg:col-span-2">
          {!resume && (
            <EmptyState
              title="No resume uploaded yet"
              body="Upload a PDF resume to unlock role matching and applications. Everything else on this page depends on it."
              action={<Link href="/candidate/resume" className="btn-primary">Upload resume</Link>}
            />
          )}

          {resume && resume.status !== 'analyzed' && (
            <div className="space-y-3">
              <p className="text-sm font-medium">{resume.file_name}</p>
              {resume.status === 'failed' || resume.status === 'requires_review' ? (
                <div className="rounded-sharp border border-evidence-partial/30 bg-evidence-partial/5 px-4 py-3">
                  <p className="text-sm font-medium text-evidence-partial">This resume needs another look</p>
                  <p className="mt-1 text-sm text-ink-soft">
                    We could not read enough text from the PDF. Your file is safe and still stored.
                    Re-upload a text-based PDF rather than a scan or image export.
                  </p>
                  <Link href="/candidate/resume" className="btn-secondary mt-3">Manage resume</Link>
                </div>
              ) : (
                <ProcessingState label="Analysing your resume. This usually takes under a minute." />
              )}
            </div>
          )}

          {resume && resume.status === 'analyzed' && analysis && (
            <div className="grid gap-6 sm:grid-cols-[auto_1fr] sm:items-center">
              <ScoreDial value={analysis.ats_score ?? 0} category={atsCategory(analysis.ats_score ?? 0)} size="lg" />
              <div>
                <p className="text-sm font-medium">{resume.file_name}</p>
                <p className="mt-1 text-sm text-ink-muted">
                  ATS readability measures how cleanly automated systems can parse your
                  resume. It is not a judgement of your experience.
                </p>
                <p className="tnum mt-3 text-sm">
                  <span className="font-semibold">{(analysis.improvements as unknown[])?.length ?? 0}</span>
                  <span className="text-ink-muted"> improvement{((analysis.improvements as unknown[])?.length ?? 0) === 1 ? '' : 's'} suggested</span>
                </p>
                <Link href="/candidate/resume" className="btn-secondary mt-4">Review full analysis</Link>
              </div>
            </div>
          )}
        </Panel>

        <Panel eyebrow="Profile" title="Completeness">
          <Stat label="Profile complete" value={`${profile?.completeness ?? 0}%`} />
          <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-rule">
            <div className="h-full bg-petrol-700 transition-all"
                 style={{ width: `${profile?.completeness ?? 0}%` }} />
          </div>
          <p className="mt-4 text-sm text-ink-muted">
            A fuller profile gives assessments more to work from and reduces
            &ldquo;insufficient evidence&rdquo; findings.
          </p>
          <Link href="/candidate/profile" className="btn-secondary mt-4">Edit profile</Link>
        </Panel>
      </div>

      <Panel eyebrow="Applications" title="Recent applications" className="mt-6"
             action={<Link href="/candidate/applications" className="btn-ghost text-sm">View all</Link>}>
        {apps.length === 0 ? (
          <EmptyState
            title="You have not applied to anything yet"
            body="Browse open roles to see how your resume maps to each one before you apply."
            action={<Link href="/candidate/jobs" className="btn-primary">Browse roles</Link>}
          />
        ) : (
          <ul className="divide-y divide-rule">
            {apps.map((a) => {
              const job = a.jobs as unknown as { title: string; company: string } | null;
              const score = a.application_scores as unknown as { overall: number; category: MatchCategory } | null;
              return (
                <li key={a.id}>
                  <Link href={`/candidate/applications/${a.id}`}
                        className="flex items-center justify-between gap-4 py-3.5 hover:bg-wash">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{job?.title ?? 'Role'}</p>
                      <p className="mt-0.5 text-sm text-ink-muted">{job?.company}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-4">
                      <span className="font-mono text-micro uppercase tracking-wider text-ink-muted">
                        {STAGE_LABEL[a.stage] ?? a.stage}
                      </span>
                      {score && <CategoryPill category={score.category} />}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </AppShell>
  );
}

function atsCategory(score: number): MatchCategory {
  if (score >= 85) return 'strong';
  if (score >= 70) return 'good';
  if (score >= 50) return 'potential';
  return 'low';
}
