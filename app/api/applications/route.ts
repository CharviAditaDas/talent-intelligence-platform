import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCandidateId, errorResponse } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { enqueue, notifyUser } from '@/lib/ai/service';

export const runtime = 'nodejs';

const bodySchema = z.object({ jobId: z.string().uuid() });

/**
 * Apply to a role (§31).
 *
 * Snapshots the job specification and resume text onto the application at
 * submission time. This is what makes §16 work: editing a job or replacing a
 * resume later cannot retroactively change an existing assessment, because
 * the assessment was run against the snapshot, not against live rows.
 */
export async function POST(request: Request) {
  try {
    const { user, candidateId } = await requireCandidateId();
    const supabase = await createClient();

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'A job must be specified.' }, { status: 400 });
    }
    const { jobId } = parsed.data;

    const { data: job } = await supabase
      .from('jobs')
      .select('id, title, company, description, responsibilities, preferred_quals, nice_to_have, experience_min, experience_max, education_level, status, spec_version, recruiter_id')
      .eq('id', jobId)
      .maybeSingle();

    if (!job) return NextResponse.json({ error: 'That role could not be found.' }, { status: 404 });
    if (job.status !== 'active') {
      return NextResponse.json(
        { error: 'This role is no longer accepting applications.' }, { status: 409 },
      );
    }

    const { data: resume } = await supabase
      .from('resumes')
      .select('id, extracted_text, status')
      .eq('candidate_id', candidateId).eq('is_active', true).maybeSingle();

    if (!resume) {
      return NextResponse.json(
        { error: 'Upload a resume before applying.', code: 'no_resume' }, { status: 409 },
      );
    }
    if (!resume.extracted_text) {
      return NextResponse.json(
        { error: 'Your resume could not be read, so it cannot be assessed yet. Re-upload a text-based PDF.', code: 'unreadable_resume' },
        { status: 409 },
      );
    }

    const { data: requirements } = await supabase
      .from('job_requirements').select('id, label, kind, importance, detail')
      .eq('job_id', jobId).order('sort_order');

    const { data: application, error } = await supabase
      .from('applications')
      .insert({
        job_id: jobId,
        candidate_id: candidateId,
        resume_id: resume.id,
        job_spec_snapshot: {
          spec_version: job.spec_version,
          title: job.title,
          company: job.company,
          description: job.description,
          responsibilities: job.responsibilities,
          preferred_quals: job.preferred_quals,
          nice_to_have: job.nice_to_have,
          experience_min: job.experience_min,
          experience_max: job.experience_max,
          education_level: job.education_level,
          requirements: requirements ?? [],
          captured_at: new Date().toISOString(),
        },
        resume_text_snapshot: resume.extracted_text,
        stage: 'submitted',
        screening_status: 'queued',
      })
      .select('id')
      .single();

    if (error) {
      // The (job_id, candidate_id) unique constraint is the guard against
      // duplicate applications, including from double-submits.
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'You have already applied to this role.', code: 'duplicate' }, { status: 409 },
        );
      }
      throw error;
    }

    await supabase.from('application_events').insert({
      application_id: application.id,
      actor_id: user.id,
      to_stage: 'submitted',
      kind: 'submitted',
      note: 'Application submitted.',
    });

    // §31: screening starts automatically. The candidate never triggers it.
    await enqueue('application_screening', application.id);

    await notifyUser(job.recruiter_id, {
      kind: 'new_application',
      title: 'New application',
      body: `A candidate applied to ${job.title}. Screening is running.`,
      link: `/recruiter/applications/${application.id}`,
    });

    return NextResponse.json({ id: application.id, status: 'queued' }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
