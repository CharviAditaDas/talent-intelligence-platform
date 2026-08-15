import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole, errorResponse } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { enqueue } from '@/lib/ai/service';

export const runtime = 'nodejs';

const jobSchema = z.object({
  title: z.string().trim().min(2).max(160),
  company: z.string().trim().min(1).max(160),
  location: z.string().trim().min(1).max(160),
  employmentType: z.enum(['full_time', 'part_time', 'contract', 'internship']).default('full_time'),
  description: z.string().trim().min(40).max(20000),
  responsibilities: z.array(z.string().trim().max(400)).max(30).default([]),
  preferredQuals: z.array(z.string().trim().max(400)).max(30).default([]),
  niceToHave: z.array(z.string().trim().max(400)).max(30).default([]),
  experienceMin: z.number().min(0).max(60).nullable().optional(),
  experienceMax: z.number().min(0).max(60).nullable().optional(),
  educationLevel: z.string().trim().max(120).nullable().optional(),
  status: z.enum(['draft', 'active']).default('draft'),
});

export async function POST(request: Request) {
  try {
    const user = await requireRole('recruiter', 'admin');
    const supabase = await createClient();

    const parsed = jobSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({
        error: 'Some fields need attention.',
        fields: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      }, { status: 400 });
    }
    const b = parsed.data;

    if (b.experienceMin != null && b.experienceMax != null && b.experienceMax < b.experienceMin) {
      return NextResponse.json({ error: 'Maximum experience cannot be lower than minimum.' }, { status: 400 });
    }

    const { data: job, error } = await supabase
      .from('jobs')
      .insert({
        recruiter_id: user.id,
        title: b.title, company: b.company, location: b.location,
        employment_type: b.employmentType, description: b.description,
        responsibilities: b.responsibilities, preferred_quals: b.preferredQuals,
        nice_to_have: b.niceToHave, experience_min: b.experienceMin ?? null,
        experience_max: b.experienceMax ?? null, education_level: b.educationLevel ?? null,
        status: b.status,
        published_at: b.status === 'active' ? new Date().toISOString() : null,
      })
      .select('id')
      .single();

    if (error) throw error;

    // §24: derive the structured hiring specification. Queued rather than
    // inline so a slow model never blocks the recruiter's form submit.
    await enqueue('job_analysis', job.id);

    return NextResponse.json({ id: job.id }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
