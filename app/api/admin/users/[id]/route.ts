import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole, errorResponse } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const bodySchema = z.object({
  isActive: z.boolean().optional(),
  role: z.enum(['candidate', 'recruiter', 'admin']).optional(),
});

/** Admin user management (§53). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireRole('admin');
    const { id } = await params;
    const supabase = await createClient();

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid update.' }, { status: 400 });

    // An admin locking themselves out would leave the platform unadministrable.
    if (id === admin.id) {
      if (parsed.data.isActive === false) {
        return NextResponse.json({ error: 'You cannot deactivate your own account.' }, { status: 409 });
      }
      if (parsed.data.role && parsed.data.role !== 'admin') {
        return NextResponse.json({ error: 'You cannot remove your own administrator role.' }, { status: 409 });
      }
    }

    const patch: Record<string, unknown> = {};
    if (parsed.data.isActive != null) patch.is_active = parsed.data.isActive;
    if (parsed.data.role != null) patch.role = parsed.data.role;
    if (Object.keys(patch).length === 0) return NextResponse.json({ ok: true, unchanged: true });

    const { error } = await supabase.from('profiles').update(patch).eq('id', id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
