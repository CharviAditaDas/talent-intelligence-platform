import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole, errorResponse } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { compareCandidates } from '@/lib/ai/service';
import { AiError } from '@/lib/ai/groq';

export const runtime = 'nodejs';
export const maxDuration = 60;

const bodySchema = z.object({
  jobId: z.string().uuid(),
  applicationIds: z.array(z.string().uuid()).min(2).max(5),
});

/** Candidate comparison (§47). */
export async function POST(request: Request) {
  try {
    const user = await requireRole('recruiter', 'admin');
    const supabase = await createClient();

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Select between two and five candidates to compare.' }, { status: 400 });
    }

    const { data: job } = await supabase
      .from('jobs').select('id, title, recruiter_id').eq('id', parsed.data.jobId).maybeSingle();
    if (!job) return NextResponse.json({ error: 'Role not found.' }, { status: 404 });
    if (user.role === 'recruiter' && job.recruiter_id !== user.id) {
      return NextResponse.json({ error: 'Role not found.' }, { status: 404 });
    }

    // Filtering on job_id as well as the id list stops a caller from splicing
    // in an application that belongs to a different role.
    const { data: apps } = await supabase
      .from('applications')
      .select(`id, candidate_profiles(profiles(full_name)),
               application_analyses(requirement_matrix, strengths, concerns)`)
      .eq('job_id', job.id)
      .in('id', parsed.data.applicationIds);

    if (!apps || apps.length < 2) {
      return NextResponse.json(
        { error: 'At least two screened candidates from this role are needed.' }, { status: 409 },
      );
    }

    const payload = apps.map((a, i) => {
      const cp = a.candidate_profiles as unknown as { profiles: { full_name: string } | null } | null;
      const an = a.application_analyses as unknown as {
        requirement_matrix: Array<{ label: string; state: string }>;
        strengths: string[]; concerns: string[];
      } | null;
      return {
        ref: cp?.profiles?.full_name || `Candidate ${String.fromCharCode(65 + i)}`,
        matrix: (an?.requirement_matrix ?? []).map((m) => ({ label: m.label, state: m.state })),
        strengths: an?.strengths ?? [],
        concerns: an?.concerns ?? [],
      };
    });

    const result = await compareCandidates(job.title, payload);
    return NextResponse.json({ ...result, candidates: payload.map((p) => p.ref) });
  } catch (err) {
    if (err instanceof AiError) {
      return NextResponse.json({
        error: 'Comparison could not be generated right now.', code: err.kind,
      }, { status: err.kind === 'rate_limit' ? 429 : 503 });
    }
    return errorResponse(err);
  }
}
