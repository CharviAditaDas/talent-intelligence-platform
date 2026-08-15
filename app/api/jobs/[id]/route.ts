import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireJobOwnership, errorResponse } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { enqueue } from '@/lib/ai/service';

export const runtime = 'nodejs';

const patchSchema = z.object({
  title: z.string().trim().min(2).max(160).optional(),
  company: z.string().trim().min(1).max(160).optional(),
  location: z.string().trim().min(1).max(160).optional(),
  employmentType: z.enum(['full_time', 'part_time', 'contract', 'internship']).optional(),
  description: z.string().trim().min(40).max(20000).optional(),
  responsibilities: z.array(z.string().trim().max(400)).max(30).optional(),
  preferredQuals: z.array(z.string().trim().max(400)).max(30).optional(),
  niceToHave: z.array(z.string().trim().max(400)).max(30).optional(),
  experienceMin: z.number().min(0).max(60).nullable().optional(),
  experienceMax: z.number().min(0).max(60).nullable().optional(),
  educationLevel: z.string().trim().max(120).nullable().optional(),
  status: z.enum(['draft', 'active', 'closed']).optional(),
});

/**
 * Edit a role (§26). Jobs stay freely editable after applications arrive —
 * no locking. Existing applications are unaffected because they were
 * screened against a snapshot taken at submission time (§16).
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireJobOwnership(id);
    const supabase = await createClient();

    const parsed = patchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({
        error: 'Some fields need attention.',
        fields: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      }, { status: 400 });
    }
    const b = parsed.data;

    const { data: current } = await supabase
      .from('jobs').select('status, spec_version, description').eq('id', id).single();
    if (!current) return NextResponse.json({ error: 'Role not found.' }, { status: 404 });

    // Changing the substance of the posting invalidates the derived spec.
    const specChanged =
      (b.description != null && b.description !== current.description) ||
      b.responsibilities != null || b.preferredQuals != null || b.niceToHave != null ||
      b.experienceMin !== undefined || b.experienceMax !== undefined || b.educationLevel !== undefined;

    const patch: Record<string, unknown> = {};
    if (b.title != null) patch.title = b.title;
    if (b.company != null) patch.company = b.company;
    if (b.location != null) patch.location = b.location;
    if (b.employmentType != null) patch.employment_type = b.employmentType;
    if (b.description != null) patch.description = b.description;
    if (b.responsibilities != null) patch.responsibilities = b.responsibilities;
    if (b.preferredQuals != null) patch.preferred_quals = b.preferredQuals;
    if (b.niceToHave != null) patch.nice_to_have = b.niceToHave;
    if (b.experienceMin !== undefined) patch.experience_min = b.experienceMin;
    if (b.experienceMax !== undefined) patch.experience_max = b.experienceMax;
    if (b.educationLevel !== undefined) patch.education_level = b.educationLevel;

    if (b.status != null && b.status !== current.status) {
      patch.status = b.status;
      // §27: closing archives. Applications and screening results survive.
      if (b.status === 'closed') patch.closed_at = new Date().toISOString();
      if (b.status === 'active') patch.published_at = new Date().toISOString();
    }

    if (specChanged) patch.spec_version = current.spec_version + 1;

    const { error } = await supabase.from('jobs').update(patch).eq('id', id);
    if (error) throw error;

    if (specChanged) await enqueue('job_analysis', id);

    return NextResponse.json({ ok: true, specReanalysing: specChanged });
  } catch (err) {
    return errorResponse(err);
  }
}
