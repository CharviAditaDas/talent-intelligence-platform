import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCandidateId, errorResponse } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { candidateMatchPreview } from '@/lib/ai/service';
import { AiError } from '@/lib/ai/groq';

export const runtime = 'nodejs';
export const maxDuration = 60;

const bodySchema = z.object({ jobId: z.string().uuid() });

/**
 * Candidate-facing match preview (§29).
 * Deliberately returns no numeric score and no ranking — a candidate must not
 * be able to infer their position relative to other applicants.
 */
export async function POST(request: Request) {
  try {
    const { candidateId } = await requireCandidateId();
    const supabase = await createClient();

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'A job must be specified.' }, { status: 400 });
    }

    const { data: job } = await supabase
      .from('jobs').select('id, title, status').eq('id', parsed.data.jobId).maybeSingle();
    if (!job || job.status !== 'active') {
      return NextResponse.json({ error: 'That role is not open.' }, { status: 404 });
    }

    const { data: resume } = await supabase
      .from('resumes').select('extracted_text')
      .eq('candidate_id', candidateId).eq('is_active', true).maybeSingle();

    if (!resume?.extracted_text) {
      return NextResponse.json(
        { error: 'Upload a readable resume to see how you match this role.', code: 'no_resume' },
        { status: 409 },
      );
    }

    const { data: requirements } = await supabase
      .from('job_requirements').select('label').eq('job_id', job.id).order('sort_order');

    const result = await candidateMatchPreview({
      jobTitle: job.title,
      requirements: (requirements ?? []).map((r) => r.label),
      resumeText: resume.extracted_text,
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AiError) {
      const status = err.kind === 'rate_limit' ? 429 : 503;
      return NextResponse.json({
        error: err.kind === 'rate_limit'
          ? 'The analysis service is busy. Try again in a moment.'
          : 'The analysis service is unavailable right now. Your data is unaffected.',
        code: err.kind,
      }, { status });
    }
    return errorResponse(err);
  }
}
