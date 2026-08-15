import { NextResponse } from 'next/server';
import { requireApplicationAccess, errorResponse } from '@/lib/auth/guards';
import { buildInterviewKit } from '@/lib/ai/service';
import { AiError } from '@/lib/ai/groq';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Generate an interview kit for this candidate-job pair (§41). */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireApplicationAccess(id);
    const result = await buildInterviewKit(id);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof AiError) {
      return NextResponse.json({
        error: err.kind === 'rate_limit'
          ? 'The analysis service is busy. Try again shortly.'
          : 'Interview questions could not be generated right now.',
        code: err.kind,
      }, { status: err.kind === 'rate_limit' ? 429 : 503 });
    }
    return errorResponse(err);
  }
}
