'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Panel, EmptyState } from '@/components/ui';

export interface NotificationItem {
  id: string; kind: string; title: string; body: string | null;
  link: string | null; readAt: string | null; createdAt: string;
}

export function NotificationsList({ items }: { items: NotificationItem[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const unread = items.filter((i) => !i.readAt).length;

  async function markAll() {
    setBusy(true);
    try {
      await fetch('/api/notifications/read', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      router.refresh();
    } finally { setBusy(false); }
  }

  async function markOne(id: string) {
    await fetch('/api/notifications/read', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(() => {});
    router.refresh();
  }

  if (items.length === 0) {
    return <EmptyState title="No notifications" body="Updates about your activity will appear here." />;
  }

  return (
    <Panel eyebrow={`${unread} unread`} title="Notifications"
           action={unread > 0 ? (
             <button className="btn-ghost text-sm" disabled={busy} onClick={markAll}>
               Mark all read
             </button>
           ) : undefined}>
      <ul className="divide-y divide-rule">
        {items.map((n) => {
          const inner = (
            <div className="flex items-start gap-3 py-3.5">
              <span aria-hidden
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.readAt ? 'bg-rule' : 'bg-petrol-700'}`} />
              <div className="min-w-0 flex-1">
                <p className={`text-sm ${n.readAt ? 'text-ink-muted' : 'font-medium'}`}>{n.title}</p>
                {n.body && <p className="mt-0.5 text-sm text-ink-muted">{n.body}</p>}
                <p className="tnum mt-1 text-xs text-ink-faint">
                  {new Date(n.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
          );
          return (
            <li key={n.id}>
              {n.link ? (
                <Link href={n.link} onClick={() => markOne(n.id)} className="block hover:bg-wash">{inner}</Link>
              ) : (
                <button className="block w-full text-left hover:bg-wash" onClick={() => markOne(n.id)}>
                  {inner}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
