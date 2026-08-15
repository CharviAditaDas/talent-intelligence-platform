/**
 * PDF ingestion tests (§10, §67, §101).
 *
 * Fixtures are generated in-process rather than read from disk, so the suite
 * runs identically on any machine with no setup step. An earlier version read
 * files from /tmp and failed on a fresh clone — a test that only passes on the
 * machine that wrote it is not a test.
 *
 * The property that matters most: every failure mode is CLASSIFIED, never an
 * unhandled throw, because an unhandled throw in the upload route is what
 * would lose a candidate's file.
 */

import {
  validateUpload, assertPdfMagic, extractPdfText, checksum,
  PdfError, PDF_ERROR_COPY, MAX_RESUME_BYTES,
} from '../lib/resume/pdf';

let pass = 0;
let fail = 0;

function check(name: string, condition: boolean, detail = '') {
  if (condition) { pass += 1; console.log(`  PASS  ${name}`); }
  else { fail += 1; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
}
function section(t: string) { console.log(`\n[${t}]`); }

/* ------------------------------------------------------------------ */
/* Fixture generation                                                  */
/* ------------------------------------------------------------------ */

/** Builds a structurally valid PDF containing a real text layer. */
function buildPdf(lines: string[]): Uint8Array {
  const esc = (s: string) =>
    s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

  let content = 'BT\n/F1 12 Tf\n';
  let y = 720;
  for (const line of lines) {
    content += `1 0 0 1 50 ${y} Tm\n(${esc(line)}) Tj\n`;
    y -= 16;
  }
  content += 'ET\n';

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R '
      + '/Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}endstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`
       + `startxref\n${xrefStart}\n%%EOF\n`;

  return new TextEncoder().encode(pdf);
}

const RESUME_LINES = [
  'JORDAN OKAFOR',
  'Backend Engineer | Nairobi, Kenya',
  'EXPERIENCE',
  'Engineer, Kite Systems (2021-2025)',
  'Built REST services in Go and Python.',
  'Designed PostgreSQL schemas handling 5M rows.',
  'SKILLS',
  'Go, Python, PostgreSQL, Docker, Kubernetes, gRPC',
  'EDUCATION',
  'BSc Computer Science, University of Nairobi, 2021',
];

const VALID = buildPdf(RESUME_LINES);
const EMPTY = buildPdf([]);
const SHORT = buildPdf(['Hi']);
const FAKE = new TextEncoder().encode('This is plain text pretending to be a PDF. '.repeat(12));
const MALFORMED = VALID.slice(0, Math.floor(VALID.length / 3));

async function expectFailure(bytes: Uint8Array, expectedCode: string, label: string) {
  try {
    await extractPdfText(bytes);
    check(label, false, 'extraction unexpectedly succeeded');
  } catch (err) {
    if (err instanceof PdfError) {
      check(label, err.code === expectedCode, `got '${err.code}', expected '${expectedCode}'`);
    } else {
      check(label, false, `threw a non-PdfError: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

/* ------------------------------------------------------------------ */

async function main() {
  section('Fixture sanity');
  check('generated PDF has a valid header',
    new TextDecoder().decode(VALID.slice(0, 5)) === '%PDF-');
  check('generated PDF is a plausible size',
    VALID.length > 300 && VALID.length < 20000, `${VALID.length} bytes`);

  /* ---------------------------------------------------------------- */
  section('Pre-upload validation');

  try {
    validateUpload({ name: 'r.pdf', size: 1000, type: 'application/pdf' });
    check('accepts a normal PDF upload', true);
  } catch { check('accepts a normal PDF upload', false); }

  const rejections: Array<[string, { name: string; size: number; type: string }, string]> = [
    ['rejects an empty file', { name: 'r.pdf', size: 0, type: 'application/pdf' }, 'empty_file'],
    ['rejects a file over 5 MB', { name: 'r.pdf', size: MAX_RESUME_BYTES + 1, type: 'application/pdf' }, 'too_large'],
    ['rejects a Word document', { name: 'r.docx', size: 1000, type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }, 'wrong_type'],
    ['rejects an image upload', { name: 'scan.png', size: 1000, type: 'image/png' }, 'wrong_type'],
  ];

  for (const [label, input, expected] of rejections) {
    try {
      validateUpload(input);
      check(label, false, 'no error raised');
    } catch (err) {
      check(label, err instanceof PdfError && err.code === expected,
        err instanceof PdfError ? `got '${err.code}'` : 'non-PdfError');
    }
  }

  try {
    validateUpload({ name: 'resume.PDF', size: 5000, type: 'application/octet-stream' });
    check('allows .pdf extension with a generic MIME type', true);
  } catch { check('allows .pdf extension with a generic MIME type', false); }

  /* ---------------------------------------------------------------- */
  section('Magic byte verification');

  try {
    assertPdfMagic(VALID);
    check('accepts a real PDF header', true);
  } catch (err) {
    check('accepts a real PDF header', false, err instanceof Error ? err.message : '');
  }

  try {
    assertPdfMagic(FAKE);
    check('rejects text masquerading as PDF', false, 'no error raised');
  } catch (err) {
    check('rejects text masquerading as PDF', err instanceof PdfError && err.code === 'not_a_pdf');
  }

  try {
    assertPdfMagic(new Uint8Array([0x25, 0x50]));
    check('rejects a truncated header', false);
  } catch (err) {
    check('rejects a truncated header', err instanceof PdfError);
  }

  /* ---------------------------------------------------------------- */
  section('Extraction — valid document');

  const good = await extractPdfText(VALID);
  check('extracts text from a valid PDF', good.text.length > 100, `${good.charCount} chars`);
  check('reports a page count', good.pageCount >= 1, String(good.pageCount));
  check('preserves the candidate name', good.text.includes('JORDAN OKAFOR'));
  check('preserves the skills line', good.text.includes('PostgreSQL'));
  check('strips pdf-parse page markers', !/--\s*\d+\s+of\s+\d+\s*--/.test(good.text));
  check('collapses excessive blank lines', !/\n{3,}/.test(good.text));
  check('trims surrounding whitespace', good.text === good.text.trim());

  /* ---------------------------------------------------------------- */
  section('Extraction — failures are classified, never unhandled');

  await expectFailure(EMPTY, 'no_text_layer', 'empty PDF -> no_text_layer');
  await expectFailure(SHORT, 'too_short', 'near-empty PDF -> too_short');
  await expectFailure(FAKE, 'not_a_pdf', 'fake PDF -> not_a_pdf');

  // A truncated file may surface as malformed, or the parser may recover part
  // of it. Either is acceptable; an unclassified throw is not.
  try {
    const recovered = await extractPdfText(MALFORMED);
    check('truncated PDF is handled', recovered.text.length > 0, 'parser recovered text');
  } catch (err) {
    check('truncated PDF is handled', err instanceof PdfError,
      err instanceof Error ? err.message.slice(0, 60) : 'unknown');
  }

  /* ---------------------------------------------------------------- */
  section('Error copy is user-facing');

  const codes = Object.keys(PDF_ERROR_COPY) as Array<keyof typeof PDF_ERROR_COPY>;
  check('every failure code has copy', codes.length >= 8, `${codes.length} codes`);
  check('no copy exposes internals',
    codes.every((c) => !/stack|exception|null|undefined|Error:/i.test(PDF_ERROR_COPY[c])));
  check('every message tells the person what to do',
    codes.every((c) => /try again|re-?export|remove|export|check/i.test(PDF_ERROR_COPY[c])));

  /* ---------------------------------------------------------------- */
  section('Checksum');

  const a = await checksum(VALID);
  const b = await checksum(VALID);
  const c = await checksum(SHORT);
  check('checksum is stable for identical bytes', a === b);
  check('checksum differs for different files', a !== c);
  check('checksum is a 64-character hex digest', /^[0-9a-f]{64}$/.test(a), a.slice(0, 16));

  // Regression guard: pdf.js detaches any buffer handed to it, which would
  // leave the caller holding a zero-length array. extractPdfText must parse a
  // copy so an upload route can still store the file after extracting.
  const survivor = buildPdf(RESUME_LINES);
  const beforeHash = await checksum(survivor);
  await extractPdfText(survivor);
  check('extraction does not detach the caller\'s buffer',
    survivor.byteLength > 0, `byteLength is ${survivor.byteLength} after parsing`);
  check('bytes are unchanged after extraction',
    (await checksum(survivor)) === beforeHash);

  /* ---------------------------------------------------------------- */
  section('Size guard matches the storage bucket limit');

  check('limit is 5 MB', MAX_RESUME_BYTES === 5 * 1024 * 1024);
  check('a normal resume is far below the limit', VALID.length < MAX_RESUME_BYTES / 100);

  console.log(`\n${'='.repeat(52)}`);
  console.log(`${pass} passed, ${fail} failed`);
  console.log('='.repeat(52));
  process.exit(fail ? 1 : 0);
}

main().catch((err) => {
  console.error('Test harness failed:', err);
  process.exit(1);
});
