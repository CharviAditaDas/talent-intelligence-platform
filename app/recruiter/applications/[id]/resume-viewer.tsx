'use client';

import { useState, useEffect, useCallback } from 'react';
import { Skeleton, ErrorState } from '@/components/ui';

/**
 * Original resume PDF, embedded in the workspace (§45).
 *
 * The recruiter must be able to verify any AI conclusion against the source,
 * so the document is never hidden behind the analysis. The URL is signed and
 * short-lived, fetched on demand rather than embedded in the server-rendered
 * HTML, so it does not linger in the page source.
 */
export function ResumeViewer({ resumeId }: { resumeId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/resumes/${resumeId}/url`);
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'The resume could not be opened.'); return; }
      setUrl(json.url); setFileName(json.fileName ?? 'resume.pdf');
    } catch {
      setError('The resume could not be opened. Check your connection and try again.');
    } finally { setLoading(false); }
  }, [resumeId]);

  useEffect(() => { load(); }, [load]);

  // Signed URLs expire after five minutes; refresh while the page stays open.
  useEffect(() => {
    const timer = setInterval(load, 4 * 60 * 1000);
    return () => clearInterval(timer);
  }, [load]);

  if (loading) return <Skeleton className="h-96 w-full" />;
  if (error) {
    return (
      <ErrorState title="Resume unavailable" body={error}
                  action={<button className="btn-secondary text-sm" onClick={load}>Try again</button>} />
    );
  }

  return (
    <div>
      <div className={`overflow-hidden border border-rule bg-wash ${expanded ? 'h-[80vh]' : 'h-96'}`}>
        {url && (
          <object data={`${url}#view=FitH`} type="application/pdf" className="h-full w-full">
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-sm text-ink-muted">
                Your browser cannot display PDFs inline.
              </p>
              <a href={url} target="_blank" rel="noopener noreferrer" className="btn-secondary text-sm">
                Open {fileName}
              </a>
            </div>
          </object>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <button className="btn-ghost text-sm" onClick={() => setExpanded((e) => !e)}>
          {expanded ? 'Collapse' : 'Expand'}
        </button>
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-petrol-700 hover:underline">
            Open in new tab
          </a>
        )}
      </div>
      <p className="mt-2 text-xs text-ink-faint">
        This is the file the candidate submitted, unmodified. Use it to verify any finding above.
      </p>
    </div>
  );
}
