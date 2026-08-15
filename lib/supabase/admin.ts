import 'server-only';
import { createClient } from '@supabase/supabase-js';

/**
 * Service-role client. BYPASSES RLS.
 *
 * Permitted callers only:
 *   - the AI worker, which must write analyses on behalf of the system
 *   - seed scripts
 *   - admin routes that have ALREADY verified the caller is an admin
 *
 * Never construct this in response to unvalidated user input, and never
 * import it into a Client Component. The `server-only` import above turns
 * any such attempt into a build error.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured.');
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
