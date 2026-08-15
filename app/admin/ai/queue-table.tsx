'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ErrorState, EmptyState } from '@/components/ui';

export interface QueueRow {
  id: string; kind: string; refId: string; status: string;
  attempts: number; maxAttempts: number; lastError: string | null; updatedAt: string;
}

const STATUS_TONE: Record<string, string> = {
  completed: 'text-evidence-yes',
  failed: 'text-evidence-no',
  rate_limited: 'text-evidence-partial',
  processing: 'text-petrol-700',
  queued: 'text-ink-muted',
  cancelled: 'text-ink-faint',
};

export function QueueTable({ rows }: { rows: QueueRow[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visible = filter ? rows.filter((r) => r.status === filter) : rows;
  const statuses = Array.from(new Set(rows.map((r) => r.status)));

  async function retry(id: string) {
    setBusyId(id); setError(null);
    try {
      const res = await fetch(`/api/admin/ai-jobs/${id}/retry`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'The job could not be requeued.'); return; }
      await fetch('/api/worker/drain', { method: 'POST' }).catch(() => {});
      router.refresh();
    } finally { setBusyId(null); }
  }

  async function drain() {
    setBusyId('drain');
    try {
      await fetch('/api/worker/drain', { method: 'POST' });
      setTimeout(() => router.refresh(), 2000);
    } finally { setBusyId(null); }
  }

  if (rows.length === 0) {
    return <EmptyState title="Queue is empty" body="Processing jobs appear here as work is enqueued." />;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button className={`chip ${filter === '' ? 'border-petrol-700 text-petrol-700' : ''}`}
                onClick={() => setFilter('')}>All ({rows.length})</button>
        {statuses.map((s) => (
          <button key={s} className={`chip ${filter === s ? 'border-petrol-700 text-petrol-700' : ''}`}
                  onClick={() => setFilter(s)}>
            {s.replace(/_/g, ' ')} ({rows.filter((r) => r.status === s).length})
          </button>
        ))}
        <button className="btn-ghost ml-auto text-sm" disabled={busyId === 'drain'} onClick={drain}>
          {busyId === 'drain' ? 'Running\u2026' : 'Run worker now'}
        </button>
      </div>

      {error && <div className="mb-4"><ErrorState title="Retry failed" body={error} /></div>}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[42rem]">
          <thead>
            <tr>
              <th className="th">Operation</th><th className="th">Status</th>
              <th className="th text-right">Attempts</th><th className="th">Last error</th>
              <th className="th">Updated</th><th className="th" />
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id}>
                <td className="td">
                  <span className="font-mono text-xs">{r.kind.replace(/_/g, ' ')}</span>
                  <span className="block font-mono text-micro text-ink-faint">{r.refId.slice(0, 8)}</span>
                </td>
                <td className="td">
                  <span className={`font-mono text-micro uppercase tracking-wider ${STATUS_TONE[r.status] ?? ''}`}>
                    {r.status.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="td tnum text-right">{r.attempts}/{r.maxAttempts}</td>
                <td className="td max-w-xs">
                  {r.lastError
                    ? <span className="block truncate text-xs text-ink-muted" title={r.lastError}>{r.lastError}</span>
                    : <span className="text-xs text-ink-faint">—</span>}
                </td>
                <td className="td tnum text-xs text-ink-muted">
                  {new Date(r.updatedAt).toLocaleString()}
                </td>
                <td className="td text-right">
                  {(r.status === 'failed' || r.status === 'cancelled') && (
                    <button className="text-sm text-petrol-700 hover:underline"
                            disabled={busyId === r.id} onClick={() => retry(r.id)}>
                      Retry
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
