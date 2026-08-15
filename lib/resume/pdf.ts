import 'server-only';

/**
 * PDF ingestion (§10, §67).
 *
 * Every failure mode here is recoverable and named. The one rule that must
 * never be broken: a stored resume file is never deleted because extraction
 * or analysis failed. We degrade the record's status instead.
 */

export const MAX_RESUME_BYTES = 5 * 1024 * 1024; // 5 MB, matches the storage bucket limit
const MIN_USABLE_CHARS = 120;

export type PdfFailureCode =
  | 'wrong_type'
  | 'too_large'
  | 'empty_file'
  | 'not_a_pdf'
  | 'encrypted'
  | 'malformed'
  | 'no_text_layer'
  | 'too_short';

export class PdfError extends Error {
  constructor(readonly code: PdfFailureCode, message: string) {
    super(message);
    this.name = 'PdfError';
  }
}

/** User-facing copy. Explains what happened and what to do — never a stack trace. */
export const PDF_ERROR_COPY: Record<PdfFailureCode, string> = {
  wrong_type: 'That file is not a PDF. Export your resume as a PDF and try again.',
  too_large: 'That file is larger than 5 MB. Export a lighter PDF — usually the images are the cause.',
  empty_file: 'That file is empty. Check the export completed and try again.',
  not_a_pdf: 'That file has a .pdf name but is not a PDF inside. Re-export it from your editor.',
  encrypted: 'That PDF is password-protected. Remove the password and upload it again.',
  malformed: 'That PDF could not be opened. Re-export it from the original document.',
  no_text_layer: 'That PDF has no selectable text — it looks like a scan or an image export. Export a text-based PDF so the text can be read.',
  too_short: 'Very little readable text was found in that PDF. If it is image-based, export a text-based version.',
};

/** Cheap checks that run before anything is read into memory. */
export function validateUpload(file: { name: string; size: number; type: string }): void {
  if (file.size === 0) throw new PdfError('empty_file', 'Uploaded file is empty.');
  if (file.size > MAX_RESUME_BYTES) throw new PdfError('too_large', 'Uploaded file exceeds 5 MB.');
  const looksPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!looksPdf) throw new PdfError('wrong_type', 'Uploaded file is not a PDF.');
}

/** Verifies the magic bytes rather than trusting the declared MIME type. */
export function assertPdfMagic(bytes: Uint8Array): void {
  if (bytes.length < 5) throw new PdfError('empty_file', 'File is too small to be a PDF.');
  const header = String.fromCharCode(...bytes.slice(0, 5));
  if (header !== '%PDF-') throw new PdfError('not_a_pdf', 'File does not begin with a PDF header.');
}

export interface ExtractionResult {
  text: string;
  pageCount: number;
  charCount: number;
}

export async function extractPdfText(bytes: Uint8Array): Promise<ExtractionResult> {
  assertPdfMagic(bytes);

  // Imported lazily so the PDF worker is only loaded on paths that need it.
  const { PDFParse } = await import('pdf-parse');

  // pdf.js TAKES OWNERSHIP of the buffer it is handed and detaches it —
  // after parsing, the caller's array is zero-length. The upload route
  // currently stores the file before extracting, so it survives, but that is
  // ordering luck rather than design: a reorder or a retry would silently
  // upload a 0-byte resume. Parse a copy so the caller's bytes stay intact.
  const owned = new Uint8Array(bytes.length);
  owned.set(bytes);

  let parser: InstanceType<typeof PDFParse> | null = null;
  try {
    parser = new PDFParse({ data: owned });
    const result = await parser.getText();
    const raw = typeof result?.text === 'string' ? result.text : '';
    const text = normalise(raw);

    if (text.length === 0) {
      throw new PdfError('no_text_layer', 'PDF contains no extractable text layer.');
    }
    if (text.length < MIN_USABLE_CHARS) {
      throw new PdfError('too_short', 'PDF contains too little text to analyse.');
    }

    return { text, pageCount: result?.total ?? 1, charCount: text.length };
  } catch (err) {
    if (err instanceof PdfError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    if (/password|encrypt/i.test(message)) {
      throw new PdfError('encrypted', 'PDF is password-protected.');
    }
    throw new PdfError('malformed', `PDF could not be parsed: ${message}`);
  } finally {
    try { await parser?.destroy(); } catch { /* parser already torn down */ }
  }
}

/**
 * Strips the page-break markers pdf-parse injects, collapses the ragged
 * whitespace typical of column layouts, and caps runaway blank lines —
 * all of which otherwise waste prompt tokens and confuse section detection.
 */
function normalise(raw: string): string {
  return raw
    .replace(/^\s*--\s*\d+\s+of\s+\d+\s*--\s*$/gm, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Stable content hash, so re-uploading an identical file is detectable. */
export async function checksum(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as unknown as ArrayBuffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
