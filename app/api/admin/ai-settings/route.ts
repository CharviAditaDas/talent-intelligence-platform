import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole, errorResponse } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const bodySchema = z.object({
  model: z.string().trim().min(3).max(120).optional(),
  enabled: z.boolean().optional(),
  maxAttempts: z.number().int().min(1).max(10).optional(),
  backoffMs: z.number().int().min(250).max(120000).optional(),
  features: z.record(z.string(), z.boolean()).optional(),
});

/**
 * Admin AI configuration (§54).
 * Only non-secret operational settings live here. Credentials remain in the
 * server environment and are never readable or writable through this route.
 */
export async function PATCH(request: Request) {
  try {
    const user = await requireRole('admin');
    const supabase = await createClient();

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Those settings are not valid.' }, { status: 400 });
    }
    const b = parsed.data;

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString(), updated_by: user.id };
    if (b.model != null) patch.model = b.model;
    if (b.enabled != null) patch.enabled = b.enabled;
    if (b.maxAttempts != null) patch.max_attempts = b.maxAttempts;
    if (b.backoffMs != null) patch.backoff_ms = b.backoffMs;
    if (b.features != null) patch.features = b.features;

    const { error } = await supabase.from('ai_settings').update(patch).eq('id', true);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
