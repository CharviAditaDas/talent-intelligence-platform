import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCandidateId, errorResponse } from '@/lib/auth/guards';
import { rewriteSection } from '@/lib/ai/service';
import { AiError } from '@/lib/ai/groq';

export const runtime = 'nodejs';
export const maxDuration = 60;

const bodySchema = z.object({
  original: z.string().trim().min(20).max(4000),
  targetRole: z.string().trim().max(160).nullable().optional(),
});

/**
 * Selective section rewriting (§40).
 * Returns variants for the candidate to review. Nothing is written back to
 * the stored resume — the original PDF is never modified by this route.
 */
export async function POST(request: Request) {
  try {
    await requireCandidateId();

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Select a longer section to rewrite — at least a sentence or two.' }, { status: 400 },
      );
    }

    const result = await rewriteSection({
      original: parsed.data.original,
      targetRole: parsed.data.targetRole ?? null,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AiError) {
      return NextResponse.json({
        error: 'Suggestions could not be generated right now.', code: err.kind,
      }, { status: err.kind === 'rate_limit' ? 429 : 503 });
    }
    return errorResponse(err);
  }
}
