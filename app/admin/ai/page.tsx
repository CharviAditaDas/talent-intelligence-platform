import { requirePage } from '@/lib/auth/guards';
import { createAdminClient } from '@/lib/supabase/admin';
import { AppShell, PageHead } from '@/components/app-shell';
import { Panel, Stat } from '@/components/ui';
import { AiSettingsForm } from './ai-settings-form';
import { QueueTable, type QueueRow } from './queue-table';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'AI operations' };

export default async function AdminAi() {
  const user = await requirePage('admin');
  const db = createAdminClient();

  const [settings, usage, jobs] = await Promise.all([
    db.from('ai_settings').select('*').eq('id', true).single(),
    db.from('ai_usage').select('kind, model, ok, prompt_tokens, output_tokens, latency_ms, error_code, created_at')
      .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()),
    db.from('ai_jobs').select('id, kind, ref_id, status, attempts, max_attempts, last_error, scheduled_for, updated_at')
      .order('updated_at', { ascending: false }).limit(50),
  ]);

  const rows = usage.data ?? [];
  const ok = rows.filter((r) => r.ok).length;
  const byKind = new Map<string, number>();
  for (const r of rows) byKind.set(r.kind, (byKind.get(r.kind) ?? 0) + 1);

  const queue: QueueRow[] = (jobs.data ?? []).map((j) => ({
    id: j.id, kind: j.kind, refId: j.ref_id, status: j.status,
    attempts: j.attempts, maxAttempts: j.max_attempts,
    lastError: j.last_error, updatedAt: j.updated_at,
  }));

  const totalTokens = rows.reduce((s, r) => s + (r.prompt_tokens ?? 0) + (r.output_tokens ?? 0), 0);
  const avgLatency = rows.length
    ? Math.round(rows.reduce((s, r) => s + (r.latency_ms ?? 0), 0) / rows.length) : 0;

  return (
    <AppShell user={user}>
      <PageHead eyebrow="Administration" title="AI operations"
                description="Provider configuration, throughput and the processing queue. Credentials are held in server environment variables and are never displayed here." />

      <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
        <Stat label="Requests (7d)" value={rows.length} />
        <Stat label="Success rate" value={rows.length ? `${((ok / rows.length) * 100).toFixed(1)}%` : '—'} />
        <Stat label="Average latency" value={avgLatency ? `${avgLatency} ms` : '—'} />
        <Stat label="Tokens (7d)" value={totalTokens.toLocaleString()} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <AiSettingsForm
          initial={{
            model: settings.data?.model ?? '',
            enabled: settings.data?.enabled ?? true,
            maxAttempts: settings.data?.max_attempts ?? 4,
            backoffMs: settings.data?.backoff_ms ?? 2000,
            features: (settings.data?.features ?? {}) as Record<string, boolean>,
          }}
          provider={settings.data?.provider ?? 'groq'}
        />

        <Panel eyebrow="Throughput" title="Requests by operation">
          {byKind.size === 0 ? (
            <p className="text-sm text-ink-muted">No AI activity in the last seven days.</p>
          ) : (
            <ul className="space-y-2.5">
              {Array.from(byKind.entries()).sort((a, b) => b[1] - a[1]).map(([kind, count]) => {
                const max = Math.max(...Array.from(byKind.values()));
                return (
                  <li key={kind} className="grid grid-cols-[10rem_1fr_2.5rem] items-center gap-3">
                    <span className="font-mono text-micro uppercase tracking-wider text-ink-muted">
                      {kind.replace(/_/g, ' ')}
                    </span>
                    <div className="h-3 w-full bg-wash">
                      <div className="h-full bg-petrol-700" style={{ width: `${(count / max) * 100}%` }} />
                    </div>
                    <span className="tnum text-right text-sm">{count}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <Panel eyebrow="Queue" title="Processing jobs" className="mt-6">
        <QueueTable rows={queue} />
      </Panel>
    </AppShell>
  );
}
