'use client';

import { useEffect } from 'react';
import Link from 'next/link';

/**
 * Root error boundary (§67).
 * Shows a plain explanation and a way forward. The underlying error is logged
 * for operators; the stack trace is never rendered to the person.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('[boundary]', error); }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center px-5">
      <div className="w-full max-w-lg">
        <p className="eyebrow">Something went wrong</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">This page could not be loaded</h1>
        <p className="mt-2 text-sm text-ink-muted">
          The problem has been recorded. Your data is unaffected — nothing was changed by
          this error. Try again, and if it keeps happening, return to your workspace.
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-micro text-ink-faint">Reference: {error.digest}</p>
        )}
        <div className="mt-6 flex gap-3">
          <button onClick={reset} className="btn-primary">Try again</button>
          <Link href="/" className="btn-secondary">Go to the home page</Link>
        </div>
      </div>
    </div>
  );
}
