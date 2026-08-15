import Link from 'next/link';
import { PublicHeader } from '@/components/site-header';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main id="main" className="mx-auto flex max-w-xl flex-1 flex-col justify-center px-5 py-20">
        <p className="eyebrow">Not found</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          That page does not exist
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          The link may be out of date, or the item may have been closed or archived.
          If you expected to see something here, it may belong to a different account.
        </p>
        <div className="mt-6 flex gap-3">
          <Link href="/" className="btn-primary">Go to the home page</Link>
          <Link href="/jobs" className="btn-secondary">Browse open roles</Link>
        </div>
      </main>
    </div>
  );
}
