import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * Authorization guards.
 *
 * These are the SECOND line of defence, not the first. RLS in Postgres is
 * authoritative (see 0002_rls.sql). These exist so that an unauthorized
 * request fails fast with a correct status code and a sensible redirect,
 * rather than succeeding at the API layer and silently returning an empty
 * result set because the database filtered every row away.
 *
 * Both layers are enforced. Removing either one must not open a hole.
 */

export type Role = 'candidate' | 'recruiter' | 'admin';

export interface SessionUser {
  id: string;
  email: string;
  role: Role;
  fullName: string;
  isActive: boolean;
}

export class AuthzError extends Error {
  constructor(readonly status: 401 | 403 | 404, message: string) {
    super(message);
    this.name = 'AuthzError';
  }
}

/** Returns the signed-in user, or null. Never throws. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, role, full_name, is_active')
    .eq('id', user.id)
    .single();

  if (!profile || !profile.is_active) return null;

  return {
    id: profile.id,
    email: profile.email,
    role: profile.role as Role,
    fullName: profile.full_name ?? '',
    isActive: profile.is_active,
  };
}

/** For API routes: throws AuthzError rather than redirecting. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthzError(401, 'Sign in to continue.');
  return user;
}

export async function requireRole(...allowed: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!allowed.includes(user.role)) {
    throw new AuthzError(403, 'Your account does not have access to this resource.');
  }
  return user;
}

/** For pages: redirects instead of throwing. */
export async function requirePage(...allowed: Role[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (!allowed.includes(user.role)) redirect(homeFor(user.role));
  return user;
}

export function homeFor(role: Role): string {
  if (role === 'admin') return '/admin';
  if (role === 'recruiter') return '/recruiter';
  return '/candidate';
}

/** Resolves the candidate_profiles row for the current candidate. */
export async function requireCandidateId(): Promise<{ user: SessionUser; candidateId: string }> {
  const user = await requireRole('candidate');
  const supabase = await createClient();
  const { data } = await supabase
    .from('candidate_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single();
  if (!data) throw new AuthzError(404, 'Candidate profile not found.');
  return { user, candidateId: data.id };
}

/**
 * §21/§94: a recruiter may only reach an application through a job they own.
 * Admin passes through. Returns the job id for downstream use.
 */
export async function requireApplicationAccess(applicationId: string): Promise<{
  user: SessionUser; jobId: string; candidateId: string;
}> {
  const user = await requireRole('recruiter', 'admin');
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('applications')
    .select('id, job_id, candidate_id, jobs!inner(recruiter_id)')
    .eq('id', applicationId)
    .single();

  // RLS already hides other recruiters' applications, so "not found" and
  // "not yours" are indistinguishable here — which is the correct behaviour.
  // It prevents probing for valid IDs.
  if (error || !data) throw new AuthzError(404, 'Application not found.');

  const job = data.jobs as unknown as { recruiter_id: string };
  if (user.role === 'recruiter' && job.recruiter_id !== user.id) {
    throw new AuthzError(404, 'Application not found.');
  }
  return { user, jobId: data.job_id, candidateId: data.candidate_id };
}

export async function requireJobOwnership(jobId: string): Promise<SessionUser> {
  const user = await requireRole('recruiter', 'admin');
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('jobs')
    .select('id, recruiter_id')
    .eq('id', jobId)
    .single();
  if (error || !data) throw new AuthzError(404, 'Job not found.');
  if (user.role === 'recruiter' && data.recruiter_id !== user.id) {
    throw new AuthzError(404, 'Job not found.');
  }
  return user;
}

/** Uniform error envelope. Never leaks stack traces to the client (§67). */
export function errorResponse(err: unknown): Response {
  if (err instanceof AuthzError) {
    return Response.json({ error: err.message }, { status: err.status });
  }
  console.error('[api]', err);
  return Response.json(
    { error: 'Something went wrong handling that request. Please try again.' },
    { status: 500 },
  );
}
