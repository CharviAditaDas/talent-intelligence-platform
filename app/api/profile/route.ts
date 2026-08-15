import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCandidateId, errorResponse } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const profileSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(40).nullable().optional(),
  location: z.string().trim().max(120).nullable().optional(),
  headline: z.string().trim().max(160).nullable().optional(),
  summary: z.string().trim().max(2000).nullable().optional(),
  linkedinUrl: z.string().trim().url().max(300).nullable().optional().or(z.literal('')),
  portfolioUrl: z.string().trim().url().max(300).nullable().optional().or(z.literal('')),
  yearsExperience: z.number().min(0).max(60).nullable().optional(),
});

/** Profile completeness drives the candidate dashboard meter (§14, §52). */
function completeness(p: Record<string, unknown>, counts: Record<string, number>): number {
  const checks = [
    !!p.headline, !!p.summary, !!p.location, !!p.phone,
    p.years_experience != null, !!p.linkedin_url,
    counts.experience > 0, counts.education > 0,
    counts.projects > 0, counts.resume > 0,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export async function PUT(request: Request) {
  try {
    const { user, candidateId } = await requireCandidateId();
    const supabase = await createClient();

    const parsed = profileSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({
        error: 'Some fields need attention.',
        fields: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      }, { status: 400 });
    }
    const body = parsed.data;

    await supabase.from('profiles').update({ full_name: body.fullName }).eq('id', user.id);

    const patch = {
      phone: body.phone || null,
      location: body.location || null,
      headline: body.headline || null,
      summary: body.summary || null,
      linkedin_url: body.linkedinUrl || null,
      portfolio_url: body.portfolioUrl || null,
      years_experience: body.yearsExperience ?? null,
    };

    await supabase.from('candidate_profiles').update(patch).eq('id', candidateId);

    const [exp, edu, proj, res] = await Promise.all([
      supabase.from('candidate_experience').select('id', { count: 'exact', head: true }).eq('candidate_id', candidateId),
      supabase.from('candidate_education').select('id', { count: 'exact', head: true }).eq('candidate_id', candidateId),
      supabase.from('candidate_projects').select('id', { count: 'exact', head: true }).eq('candidate_id', candidateId),
      supabase.from('resumes').select('id', { count: 'exact', head: true }).eq('candidate_id', candidateId).eq('is_active', true),
    ]);

    const score = completeness(patch, {
      experience: exp.count ?? 0, education: edu.count ?? 0,
      projects: proj.count ?? 0, resume: res.count ?? 0,
    });

    await supabase.from('candidate_profiles').update({ completeness: score }).eq('id', candidateId);

    return NextResponse.json({ ok: true, completeness: score });
  } catch (err) {
    return errorResponse(err);
  }
}
