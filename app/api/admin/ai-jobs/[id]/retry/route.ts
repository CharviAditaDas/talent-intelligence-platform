import { NextResponse } from 'next/server';
import { requireRole, errorResponse } from '@/lib/auth/guards';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

/** Manual retry of a failed AI job (§66). */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole('admin');
    const { id } = await params;
    const db = createAdminClient();

    const { data: job } = await db.from('ai_jobs').select('id, kind, ref_id, status').eq('id', id).maybeSingle();
    if (!job) return NextResponse.json({ error: 'Job not found.' }, { status: 404 });
    if (job.status === 'processing') {
      return NextResponse.json({ error: 'That job is currently running.' }, { status: 409 });
    }

    const { error } = await db.from('ai_jobs').update({
      status: 'queued', attempts: 0, last_error: null,
      scheduled_for: new Date().toISOString(), finished_at: null,
    }).eq('id', id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
