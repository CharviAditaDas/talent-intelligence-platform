import { NextResponse } from 'next/server';
import { drainQueue } from '@/lib/ai/service';
import { getSessionUser } from '@/lib/auth/guards';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

/**
 * AI queue worker (§64).
 *
 * Three ways in, all of them legitimate:
 *   1. AI_WORKER_SECRET  — external schedulers and the seed script
 *   2. CRON_SECRET       — Vercel Cron
 *   3. A signed-in user  — the opportunistic nudge the UI fires after an
 *                          action that enqueues work
 *
 * (3) matters more than it looks. Vercel's free plan runs cron at most once a
 * day, so without it a candidate could apply and never see their assessment.
 * It is safe to expose: draining processes system work with the service role
 * and returns only a count. No row is ever handed back to the caller, so a
 * user triggering it cannot read anything they could not already read.
 */
function hasValidSecret(request: Request): boolean {
  const header = request.headers.get('authorization') ?? '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (!token) return false;

  const workerSecret = process.env.AI_WORKER_SECRET;
  const cronSecret = process.env.CRON_SECRET;

  if (workerSecret && timingSafeEqual(token, workerSecret)) return true;
  if (cronSecret && timingSafeEqual(token, cronSecret)) return true;
  return false;
}

/** Constant-time comparison so the secret cannot be recovered by timing. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function handle(request: Request) {
  if (!hasValidSecret(request)) {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }
  }

  try {
    // Defaults are sized for a free-tier token-per-minute ceiling. A caller
    // on a paid plan can raise them: /api/worker/drain?limit=5&spacing=2000
    const params = new URL(request.url).searchParams;
    const limit = Math.min(10, Math.max(1, Number(params.get('limit')) || 1));
    const spacing = Math.min(60_000, Math.max(0, Number(params.get('spacing')) || 0));
    const result = await drainQueue(limit, spacing);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[worker]', err);
    return NextResponse.json({ error: 'Worker run failed.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return handle(request);
}

export async function GET(request: Request) {
  return handle(request);
}
