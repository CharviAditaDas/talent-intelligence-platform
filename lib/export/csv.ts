/**
 * CSV generation (§50).
 *
 * Excel-compatible: BOM so Excel detects UTF-8, CRLF line endings, and a
 * leading apostrophe guard on values that Excel would otherwise evaluate as
 * a formula. That last one is a real injection risk when exporting
 * user-supplied text such as candidate names and recruiter notes.
 */
export function toCsv(rows: Array<Record<string, unknown>>, columns?: string[]): string {
  if (rows.length === 0) return '\uFEFF';
  const cols = columns ?? Object.keys(rows[0]);
  const head = cols.map(escapeCell).join(',');
  const body = rows.map((r) => cols.map((c) => escapeCell(r[c])).join(',')).join('\r\n');
  return `\uFEFF${head}\r\n${body}`;
}

function escapeCell(value: unknown): string {
  if (value == null) return '';
  let text = Array.isArray(value) ? value.join('; ') : String(value);
  // Neutralise spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename.replace(/[^\w.\-]/g, '_')}"`,
      'Cache-Control': 'no-store',
    },
  });
}
