/**
 * Sets (or resets) the demo account passwords.
 *
 * Safe to re-run at any time — it updates existing accounts in place, so
 * profiles, roles, resumes, applications and assessments are all preserved.
 *
 * Passwords are generated here and printed ONCE. They are never written to a
 * file, never committed, and never sent anywhere. Copy them into a password
 * manager the moment they appear.
 *
 * Usage:  npx tsx --env-file=.env.local scripts/set-passwords.ts
 *
 * To choose your own instead of generating:
 *   SEED_PASSWORD_CANDIDATE='...' SEED_PASSWORD_RECRUITER='...' \
 *   SEED_PASSWORD_ADMIN='...' npx tsx --env-file=.env.local scripts/set-passwords.ts
 */
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  console.error('Run with:  npx tsx --env-file=.env.local scripts/set-passwords.ts');
  process.exit(1);
}

const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

/** URL-safe, no ambiguous characters, ~128 bits of entropy. */
function generate(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = randomBytes(22);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

async function main() {
  console.log('\nResolving demo accounts…');

  const { data: profiles, error: profileError } = await db
    .from('profiles')
    .select('id, email, role, full_name')
    .like('email', '%@demo.internal')
    .order('role');

  if (profileError) {
    console.error('Could not read profiles:', profileError.message);
    process.exit(1);
  }
  if (!profiles || profiles.length === 0) {
    console.error('No demo accounts found. Has the seed been run?');
    process.exit(1);
  }

  // One password per role, so the set stays easy to hold in your head.
  const byRole: Record<string, string> = {
    candidate: process.env.SEED_PASSWORD_CANDIDATE || generate(),
    recruiter: process.env.SEED_PASSWORD_RECRUITER || generate(),
    admin: process.env.SEED_PASSWORD_ADMIN || generate(),
  };

  for (const role of Object.keys(byRole)) {
    if (byRole[role].length < 12) {
      console.error(`The supplied ${role} password is under 12 characters. Aborting.`);
      process.exit(1);
    }
  }

  let updated = 0;
  const failures: string[] = [];

  for (const profile of profiles) {
    const password = byRole[profile.role];
    if (!password) { failures.push(`${profile.email} (unknown role ${profile.role})`); continue; }

    const { error } = await db.auth.admin.updateUserById(profile.id, {
      password,
      email_confirm: true,
    });

    if (error) failures.push(`${profile.email}: ${error.message}`);
    else { updated += 1; console.log(`  set  ${profile.email.padEnd(28)} ${profile.role}`); }
  }

  if (failures.length > 0) {
    console.error('\nSome accounts could not be updated:');
    for (const f of failures) console.error(`  ${f}`);
  }

  console.log(`\n${updated} of ${profiles.length} accounts updated.`);
  console.log('\n' + '='.repeat(62));
  console.log('  SAVE THESE NOW — they are not stored anywhere and cannot');
  console.log('  be recovered later. Re-running this script issues new ones.');
  console.log('='.repeat(62));
  for (const [role, password] of Object.entries(byRole)) {
    const emails = profiles.filter((p) => p.role === role).map((p) => p.email);
    if (emails.length === 0) continue;
    console.log(`\n  ${role.toUpperCase()}`);
    console.log(`  password: ${password}`);
    console.log(`  accounts: ${emails.join(', ')}`);
  }
  console.log('\n' + '='.repeat(62));
  console.log('  Do not paste this output into a chat, screenshot or repository.');
  console.log('='.repeat(62) + '\n');
}

main().catch((err) => {
  console.error('\nFailed:', err.message);
  process.exit(1);
});
