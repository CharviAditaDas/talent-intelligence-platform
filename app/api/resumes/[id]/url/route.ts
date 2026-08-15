import { NextResponse } from 'next/server';
import { requireUser, errorResponse, AuthzError } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * Short-lived signed URL for viewing an original resume PDF (§45).
 *
 * Authorization is not re-implemented here: the read below runs as the
 * signed-in user, so RLS decides whether this resume is visible at all.
 * A recruiter reaches a resume only via `resumes_recruiter_read`, which
 * requires an application to a job they own.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await params;
    const supabase = await createClient();

    const { data: resume } = await supabase
      .from('resumes').select('id, storage_path, file_name').eq('id', id).maybeSingle();

    if (!resume) throw new AuthzError(404, 'Resume not found.');

    const { data: signed, error } = await supabase.storage
      .from('resumes')
      .createSignedUrl(resume.storage_path, 300); // 5 minutes

    if (error || !signed) {
      return NextResponse.json({ error: 'The resume file could not be opened.' }, { status: 502 });
    }

    return NextResponse.json({ url: signed.signedUrl, fileName: resume.file_name });
  } catch (err) {
    return errorResponse(err);
  }
}
