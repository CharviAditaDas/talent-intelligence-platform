import { NextResponse } from 'next/server';
import { requireJobOwnership, errorResponse } from '@/lib/auth/guards';
import { enqueue } from '@/lib/ai/service';

export const runtime = 'nodejs';

/** Manual re-derivation of the hiring specification (§24). */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireJobOwnership(id);
    await enqueue('job_analysis', id);
    return NextResponse.json({ ok: true, status: 'queued' });
  } catch (err) {
    return errorResponse(err);
  }
}
