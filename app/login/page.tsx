import { redirect } from 'next/navigation';
import { getSessionUser, homeFor } from '@/lib/auth/guards';
import { PublicHeader } from '@/components/site-header';
import { LoginForm } from './login-form';

export const metadata = { title: 'Sign in' };

export default async function LoginPage() {
  // Already signed in? Send them where they belong. The backend decides the
  // destination from the stored role - there is no role selector (§19).
  const user = await getSessionUser();
  if (user) redirect(homeFor(user.role));

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main id="main" className="flex flex-1 items-center justify-center px-5 py-16">
        <div className="w-full max-w-sm">
          <p className="eyebrow">Account access</p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-2 text-sm text-ink-muted">
            Your workspace is determined by your account. Candidates, recruiters and
            administrators all sign in here.
          </p>
          <div className="mt-8">
            <LoginForm />
          </div>
        </div>
      </main>
    </div>
  );
}
