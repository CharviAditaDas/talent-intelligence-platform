import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApplicationAccess, errorResponse } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const bodySchema = z.object({ body: z.string().trim().min(1).max(4000) });

/** Recruiter notes. RLS keeps these invisible to candidates entirely (§57). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { user } = await requireApplicationAccess(id);
    const supabase = await createClient();

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'A note cannot be empty.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('recruiter_notes')
      .insert({ application_id: id, recruiter_id: user.id, body: parsed.data.body })
      .select('id, body, created_at')
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
