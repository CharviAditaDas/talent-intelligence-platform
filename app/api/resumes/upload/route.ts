import { NextResponse } from 'next/server';
import { requireCandidateId, errorResponse } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { enqueue } from '@/lib/ai/service';
import {
  validateUpload, extractPdfText, checksum, PdfError, PDF_ERROR_COPY,
} from '@/lib/resume/pdf';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Resume upload (§15).
 *
 * Ordering is deliberate and matters for §65: the file is stored FIRST, and
 * the database row is created before extraction is attempted. If extraction
 * then fails, the candidate still has their file and a row explaining why —
 * nothing is lost and nothing is silently discarded.
 */
export async function POST(request: Request) {
  try {
    const { user, candidateId } = await requireCandidateId();
    const supabase = await createClient();

    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file was received.' }, { status: 400 });
    }

    try {
      validateUpload({ name: file.name, size: file.size, type: file.type });
    } catch (err) {
      if (err instanceof PdfError) {
        return NextResponse.json({ error: PDF_ERROR_COPY[err.code], code: err.code }, { status: 400 });
      }
      throw err;
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const hash = await checksum(bytes);

    // Storage key is namespaced by auth uid; the storage RLS policy checks
    // that the first path segment equals auth.uid().
    const resumeId = crypto.randomUUID();
    const storagePath = `${user.id}/${resumeId}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from('resumes')
      .upload(storagePath, bytes, { contentType: 'application/pdf', upsert: false });

    if (uploadError) {
      return NextResponse.json(
        { error: 'Your file could not be stored. Please try again.' }, { status: 502 },
      );
    }

    // Retire the previous active resume. The partial unique index allows only
    // one active row per candidate, so this must happen before insert.
    await supabase.from('resumes')
      .update({ is_active: false }).eq('candidate_id', candidateId).eq('is_active', true);

    const { data: resume, error: insertError } = await supabase
      .from('resumes')
      .insert({
        id: resumeId,
        candidate_id: candidateId,
        storage_path: storagePath,
        file_name: file.name.slice(0, 200),
        file_size: file.size,
        checksum: hash,
        status: 'uploaded',
        is_active: true,
      })
      .select('id')
      .single();

    if (insertError || !resume) {
      // Roll back the orphaned object so storage does not drift from the DB.
      await supabase.storage.from('resumes').remove([storagePath]);
      return NextResponse.json({ error: 'Your resume could not be saved. Please try again.' }, { status: 500 });
    }

    // Extraction. A failure here degrades the row but never deletes it.
    try {
      const extracted = await extractPdfText(bytes);
      await supabase.from('resumes').update({
        extracted_text: extracted.text,
        page_count: extracted.pageCount,
        status: 'queued',
        extraction_error: null,
      }).eq('id', resume.id);

      await enqueue('resume_analysis', resume.id);

      return NextResponse.json({
        id: resume.id,
        status: 'queued',
        pageCount: extracted.pageCount,
        message: 'Resume uploaded. Analysis is running.',
      });
    } catch (err) {
      const code = err instanceof PdfError ? err.code : 'malformed';
      const message = PDF_ERROR_COPY[code] ?? PDF_ERROR_COPY.malformed;

      await supabase.from('resumes').update({
        status: 'requires_review',
        extraction_error: message,
      }).eq('id', resume.id);

      // 200, not an error status: the upload itself succeeded and the file is
      // safe. The client renders the recoverable state.
      return NextResponse.json({
        id: resume.id, status: 'requires_review', code, message,
      });
    }
  } catch (err) {
    return errorResponse(err);
  }
}
