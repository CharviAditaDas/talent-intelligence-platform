import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApplicationAccess, errorResponse } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { notifyUser } from '@/lib/ai/service';

export const runtime = 'nodejs';

const STAGES = [
  'submitted', 'ai_screening', 'under_review', 'shortlisted',
  'interview_1', 'interview_2', 'final_evaluation', 'offer', 'hired', 'rejected',
] as const;

const bodySchema = z.object({
  stage: z.enum(STAGES),
  note: z.string().trim().max(1000).optional(),
});

/**
 * Recruiter decision (§46).
 *
 * The recruiter's decision is written to `applications.stage` and logged as an
 * event. It NEVER touches `application_scores` — the AI assessment is
 * immutable once computed, so the two can always be shown side by side and a
 * disagreement between them stays visible rather than being erased.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { user } = await requireApplicationAccess(id);
    const supabase = await createClient();

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'A valid stage is required.' }, { status: 400 });
    }

    const { data: current } = await supabase
      .from('applications')
      .select('stage, candidate_id, jobs(title)')
      .eq('id', id).single();

    if (!current) return NextResponse.json({ error: 'Application not found.' }, { status: 404 });
    if (current.stage === parsed.data.stage) {
      return NextResponse.json({ ok: true, unchanged: true });
    }

    const { error } = await supabase
      .from('applications').update({ stage: parsed.data.stage }).eq('id', id);
    if (error) throw error;

    await supabase.from('application_events').insert({
      application_id: id,
      actor_id: user.id,
      from_stage: current.stage,
      to_stage: parsed.data.stage,
      kind: 'stage_change',
      note: parsed.data.note ?? null,
    });

    // The candidate is told their stage moved, never why or by whom (§57).
    const { data: candidate } = await supabase
      .from('candidate_profiles').select('user_id').eq('id', current.candidate_id).single();

    if (candidate) {
      const job = current.jobs as unknown as { title: string } | null;
      await notifyUser(candidate.user_id, {
        kind: 'stage_change',
        title: 'Application update',
        body: `Your application for ${job?.title ?? 'a role'} moved to ${LABEL[parsed.data.stage]}.`,
        link: `/candidate/applications/${id}`,
      });
    }

    return NextResponse.json({ ok: true, stage: parsed.data.stage });
  } catch (err) {
    return errorResponse(err);
  }
}

const LABEL: Record<string, string> = {
  submitted: 'Submitted', ai_screening: 'Screening complete', under_review: 'Under review',
  shortlisted: 'Shortlisted', interview_1: 'First interview', interview_2: 'Second interview',
  final_evaluation: 'Final evaluation', offer: 'Offer', hired: 'Hired', rejected: 'Closed',
};
