import { requirePage } from '@/lib/auth/guards';
import { createAdminClient } from '@/lib/supabase/admin';
import { AppShell, PageHead } from '@/components/app-shell';
import { Panel, Stat } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Administration' };

export default async function AdminOverview() {
  // requirePage verifies the admin role BEFORE the service-role client is
  // constructed. The elevated client is never reachable without that check.
  const user = await requirePage('admin');
  const db = createAdminClient();

  const [users, jobs, apps, resumes, failedJobs, usage, settings, events] = await Promise.all([
    db.from('profiles').select('role, is_active'),
    db.from('jobs').select('status'),
    db.from('applications').select('screening_status'),
    db.from('resumes').select('status'),
    db.from('ai_jobs').select('id, kind, status, attempts, last_error, updated_at')
      .in('status', ['failed', 'rate_limited', 'queued', 'processing']).order('updated_at', { ascending: false }).limit(10),
    db.from('ai_usage').select('ok, prompt_tokens, output_tokens, latency_ms, created_at')
      .gte('created_at', new Date(Date.now() - 86400000).toISOString()),
    db.from('ai_settings').select('*').eq('id', true).single(),
    db.from('system_events').select('level, source, message, created_at').order('created_at', { ascending: false }).limit(8),
  ]);

  const u = users.data ?? [];
  const usageRows = usage.data ?? [];
  const okCount = usageRows.filter((r) => r.ok).length;
  const successRate = usageRows.length ? ((okCount / usageRows.length) * 100).toFixed(1) : '—';
  const avgLatency = usageRows.length
    ? Math.round(usageRows.reduce((s, r) => s + (r.latency_ms ?? 0), 0) / usageRows.length)
    : 0;
  const totalTokens = usageRows.reduce((s, r) => s + (r.prompt_tokens ?? 0) + (r.output_tokens ?? 0), 0);

  return (
    <AppShell user={user}>
      <PageHead eyebrow="Administration" title="Platform overview"
                description="Users, roles, AI operations and system health." />

      <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
        <Stat label="Users" value={u.length} hint={`${u.filter((x) => !x.is_active).length} deactivated`} />
        <Stat label="Candidates" value={u.filter((x) => x.role === 'candidate').length} />
        <Stat label="Recruiters" value={u.filter((x) => x.role === 'recruiter').length} />
        <Stat label="Roles" value={(jobs.data ?? []).length}
              hint={`${(jobs.data ?? []).filter((j) => j.status === 'active').length} active`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel eyebrow="AI operations" title="Provider status">
          <dl className="space-y-3 text-sm">
            <Row label="Provider" value={settings.data?.provider ?? 'groq'} />
            <Row label="Model" value={settings.data?.model ?? '—'} mono />
            <Row label="Service" value={settings.data?.enabled ? 'Enabled' : 'Disabled'} />
            <Row label="Requests (24h)" value={String(usageRows.length)} />
            <Row label="Success rate" value={successRate === '—' ? '—' : `${successRate}%`} />
            <Row label="Average latency" value={avgLatency ? `${avgLatency} ms` : '—'} />
            <Row label="Tokens (24h)" value={totalTokens.toLocaleString()} />
          </dl>
          <p className="mt-4 border-t border-rule pt-3 text-xs text-ink-faint">
            Credentials are held in server environment variables and are never
            rendered in this interface or sent to the browser.
          </p>
        </Panel>

        <Panel eyebrow="Processing" title="Queue and failures">
          {(failedJobs.data ?? []).length === 0 ? (
            <p className="text-sm text-ink-muted">No queued, retrying or failed AI jobs.</p>
          ) : (
            <ul className="divide-y divide-rule">
              {(failedJobs.data ?? []).map((j) => (
                <li key={j.id} className="py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-micro uppercase tracking-wider">{j.kind}</span>
                    <span className="chip">{j.status}</span>
                  </div>
                  {j.last_error && (
                    <p className="mt-1 truncate text-xs text-ink-muted" title={j.last_error}>{j.last_error}</p>
                  )}
                  <p className="mt-0.5 font-mono text-micro text-ink-faint">attempt {j.attempts}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel eyebrow="System" title="Recent events" className="mt-6">
        {(events.data ?? []).length === 0 ? (
          <p className="text-sm text-ink-muted">No system events recorded.</p>
        ) : (
          <ul className="divide-y divide-rule">
            {(events.data ?? []).map((e, i) => (
              <li key={i} className="flex items-baseline gap-3 py-2.5">
                <span className={`font-mono text-micro uppercase tracking-wider ${
                  e.level === 'error' ? 'text-evidence-no' : e.level === 'warn' ? 'text-evidence-partial' : 'text-ink-faint'}`}>
                  {e.level}
                </span>
                <span className="font-mono text-micro text-ink-faint">{e.source}</span>
                <span className="flex-1 text-sm text-ink-soft">{e.message}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </AppShell>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-rule pb-2.5 last:border-b-0">
      <dt className="text-ink-muted">{label}</dt>
      <dd className={mono ? 'font-mono text-xs' : 'font-medium'}>{value}</dd>
    </div>
  );
}
