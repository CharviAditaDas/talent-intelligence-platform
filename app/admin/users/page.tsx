import { requirePage } from '@/lib/auth/guards';
import { createAdminClient } from '@/lib/supabase/admin';
import { AppShell, PageHead } from '@/components/app-shell';
import { Panel } from '@/components/ui';
import { UserTable, type UserRow } from './user-table';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Users' };

export default async function AdminUsers() {
  const user = await requirePage('admin');
  const db = createAdminClient();

  const { data } = await db
    .from('profiles').select('id, email, full_name, role, is_active, created_at')
    .order('created_at', { ascending: false });

  const rows: UserRow[] = (data ?? []).map((u) => ({
    id: u.id, email: u.email, fullName: u.full_name,
    role: u.role, isActive: u.is_active, createdAt: u.created_at,
  }));

  return (
    <AppShell user={user}>
      <PageHead eyebrow="Administration" title="Users"
                description="Roles determine what a person can reach. Deactivating an account blocks sign-in immediately." />
      <Panel eyebrow={`${rows.length} accounts`} title="All users">
        <UserTable rows={rows} currentUserId={user.id} />
      </Panel>
    </AppShell>
  );
}
