import { requirePage, type Role } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { AppShell, PageHead } from '@/components/app-shell';
import { NotificationsList, type NotificationItem } from '@/components/notifications-list';

/** Shared notifications screen; each role mounts it at its own path (§55). */
export async function NotificationsPage({ roles }: { roles: Role[] }) {
  const user = await requirePage(...roles);
  const supabase = await createClient();

  const { data } = await supabase
    .from('notifications')
    .select('id, kind, title, body, link, read_at, created_at')
    .order('created_at', { ascending: false }).limit(60);

  const items: NotificationItem[] = (data ?? []).map((n) => ({
    id: n.id, kind: n.kind, title: n.title, body: n.body,
    link: n.link, readAt: n.read_at, createdAt: n.created_at,
  }));

  return (
    <AppShell user={user}>
      <PageHead eyebrow="Notifications" title="Activity"
                description="In-app only. Nothing is emailed." />
      <NotificationsList items={items} />
    </AppShell>
  );
}
