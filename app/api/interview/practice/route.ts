import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCandidateId, errorResponse } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { practiceFeedback } from '@/lib/ai/service';
import { AiError } from '@/lib/ai/groq';

export const runtime = 'nodejs';
export const maxDuration = 60;

const bodySchema = z.object({
  prepId: z.string().uuid().nullable().optional(),
  jobTitle: z.string().trim().max(160),
  question: z.string().trim().min(1).max(1000),
  answer: z.string().trim().min(20).max(8000),
});

/** Interactive text practice (§43). */
export async function POST(request: Request) {
  try {
    const { candidateId } = await requireCandidateId();
    const supabase = await createClient();

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Write a fuller answer before requesting feedback — at least a couple of sentences.' },
        { status: 400 },
      );
    }
    const b = parsed.data;

    const feedback = await practiceFeedback({
      question: b.question, answer: b.answer, jobTitle: b.jobTitle,
    });

    const { data, error } = await supabase
      .from('interview_practice')
      .insert({
        candidate_id: candidateId,
        prep_id: b.prepId ?? null,
        question: b.question,
        answer: b.answer,
        feedback,
      })
      .select('id, created_at')
      .single();

    if (error) throw error;
    return NextResponse.json({ id: data.id, feedback });
  } catch (err) {
    if (err instanceof AiError) {
      return NextResponse.json({
        error: 'Feedback could not be generated right now. Your answer was not saved.',
        code: err.kind,
      }, { status: err.kind === 'rate_limit' ? 429 : 503 });
    }
    return errorResponse(err);
  }
}
