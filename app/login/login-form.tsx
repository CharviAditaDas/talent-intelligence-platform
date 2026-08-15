'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (signInError) {
      // Deliberately does not distinguish "no such account" from "wrong
      // password" - that difference is an account-enumeration oracle.
      setError('That email and password combination was not recognised.');
      setBusy(false);
      return;
    }

    // The server resolves the role and redirects; the client never decides.
    router.replace('/redirect');
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required
               className="field" value={email} onChange={(e) => setEmail(e.target.value)}
               aria-describedby={error ? 'login-error' : undefined} />
      </div>
      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required
               className="field" value={password} onChange={(e) => setPassword(e.target.value)}
               aria-describedby={error ? 'login-error' : undefined} />
      </div>

      {error && (
        <p id="login-error" role="alert"
           className="rounded-sharp border border-evidence-no/25 bg-evidence-no/5 px-3 py-2 text-sm text-evidence-no">
          {error}
        </p>
      )}

      <button type="submit" className="btn-primary w-full" disabled={busy}>
        {busy ? 'Signing in\u2026' : 'Sign in'}
      </button>
    </form>
  );
}
