import { requireJobOwnership, errorResponse } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { toCsv, csvResponse } from '@/lib/export/csv';

export const runtime = 'nodejs';

/** Job-level ranked export (§50). RLS scopes rows to the owning recruiter. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireJobOwnership(id);
    const supabase = await createClient();

    const { data: job } = await supabase.from('jobs').select('title, company').eq('id', id).single();

    const { data: apps } = await supabase
      .from('applications')
      .select(`id, stage, screening_status, submitted_at,
               candidate_profiles(location, years_experience, profiles(full_name, email)),
               application_scores(overall, category, components),
               application_analyses(requirement_matrix, skill_intelligence, strengths, concerns)`)
      .eq('job_id', id);

    const rows = (apps ?? []).map((a) => {
      const cp = a.candidate_profiles as unknown as {
        location: string | null; years_experience: number | null;
        profiles: { full_name: string; email: string } | null;
      } | null;
      const score = a.application_scores as unknown as { overall: number; category: string } | null;
      const analysis = a.application_analyses as unknown as {
        requirement_matrix: Array<{ label: string; state: string; importance: string }>;
        skill_intelligence: { matching: string[]; missing: string[] };
        strengths: string[]; concerns: string[];
      } | null;

      const matrix = analysis?.requirement_matrix ?? [];
      return {
        candidate: cp?.profiles?.full_name ?? '',
        email: cp?.profiles?.email ?? '',
        location: cp?.location ?? '',
        years_experience: cp?.years_experience ?? '',
        fit_score: score?.overall ?? '',
        match_category: score?.category ?? 'not screened',
        stage: a.stage,
        screening_status: a.screening_status,
        applied_on: a.submitted_at ? new Date(a.submitted_at).toISOString().slice(0, 10) : '',
        requirements_demonstrated: matrix.filter((m) => m.state === 'demonstrated').length,
        requirements_insufficient: matrix.filter((m) => m.state === 'insufficient').length,
        requirements_not_demonstrated: matrix.filter((m) => m.state === 'not_demonstrated').length,
        required_unmet: matrix.filter((m) => m.importance === 'required' && m.state !== 'demonstrated')
          .map((m) => m.label),
        matching_skills: analysis?.skill_intelligence?.matching ?? [],
        missing_skills: analysis?.skill_intelligence?.missing ?? [],
        strengths: analysis?.strengths ?? [],
        concerns: analysis?.concerns ?? [],
      };
    });

    rows.sort((a, b) => (Number(b.fit_score) || 0) - (Number(a.fit_score) || 0));

    const slug = (job?.title ?? 'role').toLowerCase().replace(/\s+/g, '-');
    return csvResponse(toCsv(rows), `${slug}-candidates.csv`);
  } catch (err) {
    return errorResponse(err);
  }
}
