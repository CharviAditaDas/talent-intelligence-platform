import { redirect } from 'next/navigation';
import { getSessionUser, homeFor } from '@/lib/auth/guards';

/** Server-side role resolution after sign-in (§19). */
export default async function RedirectPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  redirect(homeFor(user.role));
}
