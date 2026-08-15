import Link from 'next/link';
import { requirePage } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { AppShell, PageHead } from '@/components/app-shell';
import { EmptyState } from '@/components/ui';
import { CompareView, type CompareCandidate } from './compare-view';
import type { MatchCategory } from '@/lib/scoring/engine';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Compare candidates' };

export default async function ComparePage({
  searchParams,
}: { searchParams: Promise<{ job?: string; ids?: string }> }) {
  const sp = await searchParams;
  const user = await requirePage('recruiter', 'admin');
  const supabase = await createClient();

  const ids = (sp.ids ?? '').split(',').map((s) => s.trim()).filter(Boolean);

  if (!sp.job || ids.length < 2) {
    return (
      <AppShell user={user}>
        <PageHead eyebrow="Compare" title="Compare candidates" />
        <EmptyState title="Select candidates to compare"
                    body="Open a role, tick two to five applicants in the ranking table, then choose Compare."
                    action={<Link href="/recruiter/jobs" className="btn-primary">Go to roles</Link>} />
      </AppShell>
    );
  }

  const { data: job } = await supabase.from('jobs').select('id, title').eq('id', sp.job).maybeSingle();

  // Scoped by job_id as well as the id list, so an id from another role
  // cannot be spliced into the comparison via the query string.
  const { data: apps } = await supabase
    .from('applications')
    .select(`id, stage, candidate_profiles(years_experience, profiles(full_name)),
             application_scores(overall, category, components),
             application_analyses(requirement_matrix, skill_intelligence, strengths, concerns)`)
    .eq('job_id', sp.job).in('id', ids);

  const candidates: CompareCandidate[] = (apps ?? []).map((a) => {
    const cp = a.candidate_profiles as unknown as {
      years_experience: number | null; profiles: { full_name: string } | null;
    } | null;
    const score = a.application_scores as unknown as {
      overall: number; category: MatchCategory;
      components: Array<{ dimension: string; raw: number; weight: number }>;
    } | null;
    const an = a.application_analyses as unknown as {
      requirement_matrix: Array<{ label: string; importance: string; state: string }>;
      skill_intelligence: { matching: string[]; missing: string[] };
      strengths: string[]; concerns: string[];
    } | null;
    return {
      id: a.id,
      name: cp?.profiles?.full_name ?? 'Candidate',
      years: cp?.years_experience ?? null,
      stage: a.stage,
      score: score ? Number(score.overall) : null,
      category: score?.category ?? null,
      components: score?.components ?? [],
      matrix: an?.requirement_matrix ?? [],
      matching: an?.skill_intelligence?.matching ?? [],
      missing: an?.skill_intelligence?.missing ?? [],
      strengths: an?.strengths ?? [],
      concerns: an?.concerns ?? [],
    };
  });

  return (
    <AppShell user={user}>
      <Link href={`/recruiter/jobs/${sp.job}`}
            className="font-mono text-micro uppercase tracking-wider text-ink-faint hover:text-ink">
        &larr; {job?.title ?? 'Role'}
      </Link>
      <div className="mt-4">
        <PageHead eyebrow={job?.title ?? 'Role'} title="Compare candidates"
                  description="Side-by-side evidence coverage. No candidate is ranked above another here — the tradeoffs are yours to weigh." />
      </div>
      <CompareView jobId={sp.job} jobTitle={job?.title ?? ''} candidates={candidates} />
    </AppShell>
  );
}
