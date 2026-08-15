'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export function JobActions({ jobId, status }: { jobId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function setStatus(next: 'active' | 'closed' | 'draft') {
    setBusy(true);
    try {
      await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      router.refresh();
    } finally { setBusy(false); }
  }

  async function reanalyse() {
    setBusy(true);
    try {
      await fetch(`/api/jobs/${jobId}/analyze`, { method: 'POST' });
      await fetch('/api/worker/drain', { method: 'POST' });
      setTimeout(() => router.refresh(), 2500);
    } finally { setBusy(false); }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Link href={`/recruiter/jobs/${jobId}/edit`} className="btn-secondary text-sm">Edit</Link>
      <button className="btn-secondary text-sm" disabled={busy} onClick={reanalyse}>
        Re-derive specification
      </button>
      {status === 'active' ? (
        <button className="btn-secondary text-sm" disabled={busy} onClick={() => setStatus('closed')}>
          Close role
        </button>
      ) : (
        <button className="btn-primary text-sm" disabled={busy} onClick={() => setStatus('active')}>
          {status === 'closed' ? 'Reopen role' : 'Publish role'}
        </button>
      )}
    </div>
  );
}
