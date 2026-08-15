import { requirePage } from '@/lib/auth/guards';
import { createAdminClient } from '@/lib/supabase/admin';
import { AppShell, PageHead } from '@/components/app-shell';
import { Panel, Stat, EmptyState } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'System' };

export default async function AdminSystem() {
  const user = await requirePage('admin');
  const db = createAdminClient();

  const [events, resumes, apps, storage] = await Promise.all([
    db.from('system_events').select('level, source, message, context, created_at')
      .order('created_at', { ascending: false }).limit(60),
    db.from('resumes').select('status, file_size'),
    db.from('applications').select('screening_status'),
    db.from('resumes').select('file_size'),
  ]);

  const resumeRows = resumes.data ?? [];
  const appRows = apps.data ?? [];
  const totalBytes = (storage.data ?? []).reduce((s, r) => s + (r.file_size ?? 0), 0);

  const byStatus = (rows: Array<{ status?: string; screening_status?: string }>, key: 'status' | 'screening_status') => {
    const m = new Map<string, number>();
    for (const r of rows) {
      const v = (r as Record<string, string | undefined>)[key] ?? 'unknown';
      m.set(v, (m.get(v) ?? 0) + 1);
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  };

  return (
    <AppShell user={user}>
      <PageHead eyebrow="Administration" title="System"
                description="Processing health, storage use and recent platform events." />

      <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
        <Stat label="Resumes" value={resumeRows.length} />
        <Stat label="Applications" value={appRows.length} />
        <Stat label="Storage used" value={`${(totalBytes / 1048576).toFixed(1)} MB`} hint="Free tier: 1 GB" />
        <Stat label="Needing review"
              value={resumeRows.filter((r) => r.status === 'requires_review' || r.status === 'failed').length} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel eyebrow="Resumes" title="Processing status">
          <ul className="space-y-2">
            {byStatus(resumeRows, 'status').map(([k, v]) => (
              <li key={k} className="flex items-center justify-between border-b border-rule pb-2 last:border-b-0">
                <span className="font-mono text-micro uppercase tracking-wider text-ink-muted">
                  {k.replace(/_/g, ' ')}
                </span>
                <span className="tnum text-sm font-medium">{v}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel eyebrow="Screening" title="Application status">
          <ul className="space-y-2">
            {byStatus(appRows, 'screening_status').map(([k, v]) => (
              <li key={k} className="flex items-center justify-between border-b border-rule pb-2 last:border-b-0">
                <span className="font-mono text-micro uppercase tracking-wider text-ink-muted">
                  {k.replace(/_/g, ' ')}
                </span>
                <span className="tnum text-sm font-medium">{v}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel eyebrow="Events" title="Recent system events" className="mt-6">
        {(events.data ?? []).length === 0 ? (
          <EmptyState title="No events" body="Warnings and errors from processing appear here." />
        ) : (
          <ul className="divide-y divide-rule">
            {(events.data ?? []).map((e, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2.5">
                <span className={`font-mono text-micro uppercase tracking-wider ${
                  e.level === 'error' ? 'text-evidence-no'
                  : e.level === 'warn' ? 'text-evidence-partial' : 'text-ink-faint'}`}>
                  {e.level}
                </span>
                <span className="font-mono text-micro text-ink-faint">{e.source}</span>
                <span className="flex-1 text-sm text-ink-soft">{e.message}</span>
                <span className="tnum text-xs text-ink-faint">
                  {new Date(e.created_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </AppShell>
  );
}
