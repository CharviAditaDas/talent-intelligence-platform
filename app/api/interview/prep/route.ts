import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCandidateId, errorResponse } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { buildInterviewPrep } from '@/lib/ai/service';
import { AiError } from '@/lib/ai/groq';

export const runtime = 'nodejs';
export const maxDuration = 60;

const bodySchema = z.object({ jobId: z.string().uuid(), force: z.boolean().optional() });

/** Candidate interview preparation (§42). Cached per candidate-job pair (§87). */
export async function POST(request: Request) {
  try {
    const { candidateId } = await requireCandidateId();
    const supabase = await createClient();

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'A role must be specified.' }, { status: 400 });

    // A candidate may only prepare for a role they applied to or that is open.
    const { data: job } = await supabase
      .from('jobs').select('id, status').eq('id', parsed.data.jobId).maybeSingle();
    if (!job) return NextResponse.json({ error: 'Role not found.' }, { status: 404 });

    if (!parsed.data.force) {
      const { data: existing } = await supabase
        .from('interview_preps').select('id')
        .eq('candidate_id', candidateId).eq('job_id', job.id).maybeSingle();
      if (existing) return NextResponse.json({ ok: true, cached: true });
    }

    const result = await buildInterviewPrep(candidateId, job.id);
    return NextResponse.json({ ok: true, cached: false, ...result });
  } catch (err) {
    if (err instanceof AiError) {
      return NextResponse.json({
        error: err.kind === 'refused'
          ? 'Upload a readable resume before generating preparation.'
          : 'Preparation could not be generated right now.',
        code: err.kind,
      }, { status: err.kind === 'rate_limit' ? 429 : 503 });
    }
    return errorResponse(err);
  }
}
