import { NextResponse } from 'next/server';
import { requireApplicationAccess, errorResponse } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { enqueue } from '@/lib/ai/service';

export const runtime = 'nodejs';

/**
 * Explicit recruiter-triggered re-analysis (§87).
 * Analysis is otherwise cached — this is the one supported way to spend a
 * fresh model call on an application that has already been screened.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireApplicationAccess(id);
    const supabase = await createClient();

    await supabase.from('applications').update({ screening_status: 'queued' }).eq('id', id);
    await enqueue('application_screening', id);

    return NextResponse.json({ ok: true, status: 'queued' });
  } catch (err) {
    return errorResponse(err);
  }
}
