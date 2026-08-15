import { requireApplicationAccess, errorResponse } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { toCsv, csvResponse } from '@/lib/export/csv';

export const runtime = 'nodejs';

/** Individual candidate report (§50) — one row per requirement, plus a summary block. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireApplicationAccess(id);
    const supabase = await createClient();

    const { data: app } = await supabase
      .from('applications')
      .select(`id, stage, submitted_at, jobs(title, company),
               candidate_profiles(location, years_experience, profiles(full_name, email)),
               application_scores(overall, category, components),
               application_analyses(requirement_matrix, summary, strengths, concerns)`)
      .eq('id', id).single();

    if (!app) return new Response('Not found', { status: 404 });

    const cp = app.candidate_profiles as unknown as {
      profiles: { full_name: string; email: string } | null;
    } | null;
    const job = app.jobs as unknown as { title: string; company: string } | null;
    const score = app.application_scores as unknown as {
      overall: number; category: string;
      components: Array<{ dimension: string; raw: number; weight: number; contribution: number }>;
    } | null;
    const analysis = app.application_analyses as unknown as {
      requirement_matrix: Array<{ label: string; importance: string; state: string; evidence: string | null; reasoning: string }>;
      summary: string; strengths: string[]; concerns: string[];
    } | null;

    const rows: Array<Record<string, unknown>> = [];

    rows.push({ section: 'candidate', item: 'Name', value: cp?.profiles?.full_name ?? '', detail: '' });
    rows.push({ section: 'candidate', item: 'Email', value: cp?.profiles?.email ?? '', detail: '' });
    rows.push({ section: 'role', item: 'Title', value: job?.title ?? '', detail: job?.company ?? '' });
    rows.push({ section: 'assessment', item: 'Fit score', value: score?.overall ?? '', detail: score?.category ?? '' });
    rows.push({ section: 'assessment', item: 'Recruiter stage', value: app.stage, detail: 'Set by recruiter, independent of AI assessment' });

    for (const c of score?.components ?? []) {
      rows.push({
        section: 'score_breakdown', item: c.dimension,
        value: c.raw, detail: `weight ${c.weight}, contributes ${c.contribution}`,
      });
    }
    for (const m of analysis?.requirement_matrix ?? []) {
      rows.push({
        section: 'requirement', item: m.label,
        value: `${m.importance} / ${m.state}`,
        detail: m.evidence ?? m.reasoning ?? '',
      });
    }
    for (const s of analysis?.strengths ?? []) rows.push({ section: 'strength', item: '', value: s, detail: '' });
    for (const c of analysis?.concerns ?? []) rows.push({ section: 'concern', item: '', value: c, detail: '' });
    if (analysis?.summary) rows.push({ section: 'summary', item: '', value: analysis.summary, detail: '' });

    const slug = (cp?.profiles?.full_name ?? 'candidate').toLowerCase().replace(/\s+/g, '-');
    return csvResponse(toCsv(rows, ['section', 'item', 'value', 'detail']), `${slug}-assessment.csv`);
  } catch (err) {
    return errorResponse(err);
  }
}
