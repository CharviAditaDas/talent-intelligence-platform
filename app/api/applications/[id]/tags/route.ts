import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApplicationAccess, errorResponse } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const bodySchema = z.object({ tag: z.string().trim().min(1).max(40) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { user } = await requireApplicationAccess(id);
    const supabase = await createClient();

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'A tag is required.' }, { status: 400 });

    const tag = parsed.data.tag.toLowerCase();
    const { error } = await supabase
      .from('application_tags')
      .insert({ application_id: id, tag, created_by: user.id });

    if (error && error.code !== '23505') throw error;
    return NextResponse.json({ ok: true, tag });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireApplicationAccess(id);
    const supabase = await createClient();

    const tag = new URL(request.url).searchParams.get('tag');
    if (!tag) return NextResponse.json({ error: 'A tag is required.' }, { status: 400 });

    await supabase.from('application_tags').delete().eq('application_id', id).eq('tag', tag.toLowerCase());
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
