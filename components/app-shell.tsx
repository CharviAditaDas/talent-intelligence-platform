import Link from 'next/link';
import { Wordmark } from './site-header';
import { createClient } from '@/lib/supabase/server';
import type { SessionUser } from '@/lib/auth/guards';

const NAV: Record<string, Array<[string, string]>> = {
  candidate: [
    ['Overview', '/candidate'],
    ['Profile', '/candidate/profile'],
    ['Resume', '/candidate/resume'],
    ['Roles', '/candidate/jobs'],
    ['Applications', '/candidate/applications'],
    ['Interview prep', '/candidate/interview'],
  ],
  recruiter: [
    ['Overview', '/recruiter'],
    ['Roles', '/recruiter/jobs'],
    ['Pipeline', '/recruiter/pipeline'],
  ],
  admin: [
    ['Overview', '/admin'],
    ['Users', '/admin/users'],
    ['Roles', '/admin/jobs'],
    ['AI operations', '/admin/ai'],
    ['System', '/admin/system'],
  ],
};

export async function AppShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const supabase = await createClient();
  const { count: unread } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null);

  const nav = NAV[user.role] ?? [];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-rule bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-5 py-3">
          <div className="flex items-center gap-6">
            <Wordmark />
            <span className="hidden font-mono text-micro uppercase tracking-[0.14em] text-ink-faint sm:inline">
              {user.role}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link href={`/${user.role}/notifications`} className="btn-ghost relative text-sm">
              Notifications
              {unread ? (
                <span className="tnum ml-1 rounded-sharp bg-petrol-700 px-1.5 py-0.5 font-mono text-micro text-white">
                  {unread}
                </span>
              ) : null}
            </Link>
            <form action="/api/auth/signout" method="post">
              <button type="submit" className="btn-ghost text-sm">Sign out</button>
            </form>
          </div>
        </div>
        <nav aria-label="Primary" className="mx-auto max-w-7xl overflow-x-auto px-5">
          <ul className="flex gap-1">
            {nav.map(([label, href]) => (
              <li key={href}>
                <Link href={href}
                      className="inline-block whitespace-nowrap border-b-2 border-transparent px-3 py-2.5 text-sm text-ink-soft hover:border-rule hover:text-ink">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-5 py-8">{children}</main>
    </div>
  );
}

export function PageHead({ eyebrow, title, description, action }: {
  eyebrow: string; title: string; description?: string; action?: React.ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-ink-muted">{description}</p>}
      </div>
      {action}
    </header>
  );
}
