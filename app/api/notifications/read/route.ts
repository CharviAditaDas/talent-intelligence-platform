import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser, errorResponse } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const bodySchema = z.object({ id: z.string().uuid().optional(), all: z.boolean().optional() });

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const supabase = await createClient();

    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    const now = new Date().toISOString();
    let query = supabase.from('notifications').update({ read_at: now }).eq('user_id', user.id).is('read_at', null);

    if (parsed.success && parsed.data.id && !parsed.data.all) {
      query = query.eq('id', parsed.data.id);
    }
    const { error } = await query;
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
