import Link from 'next/link';
import { requirePage } from '@/lib/auth/guards';
import { AppShell, PageHead } from '@/components/app-shell';
import { JobForm } from '../job-form';

export const metadata = { title: 'Create a role' };

export default async function NewJob() {
  const user = await requirePage('recruiter', 'admin');
  return (
    <AppShell user={user}>
      <Link href="/recruiter/jobs" className="font-mono text-micro uppercase tracking-wider text-ink-faint hover:text-ink">
        &larr; Roles
      </Link>
      <div className="mt-4">
        <PageHead eyebrow="New role" title="Create a role"
                  description="Write the posting as you normally would. It is converted into discrete, individually assessable requirements you can review and edit." />
      </div>
      <JobForm mode="create" />
    </AppShell>
  );
}
