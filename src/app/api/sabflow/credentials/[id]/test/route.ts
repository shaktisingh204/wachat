/**
 * SabFlow — Credential test-connection API.
 *
 *   POST /api/sabflow/credentials/[id]/test → { ok, error?, details? }
 *
 * - Auth-gated via the existing user session (`@/app/actions/user.actions`).
 * - Rate-limited to 10 tests per minute per credential (per-user key) using
 *   the shared in-memory sliding-window store.
 * - Every attempt is audit-logged via `recordFlowAction` regardless of
 *   outcome.  Run-time errors collapse to `{ ok: false, error }`.
 *
 * The actual probe logic lives in
 * `src/lib/sabflow/executor/credentials/test.ts` and is dispatched from a
 * forward-declared registry so we don't import every provider here.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/app/actions/user.actions';
import { testCredential } from '@/lib/sabflow/executor/credentials/test';
import { checkRateLimit } from '@/lib/sabflow/apiRateLimit/store';
import { recordFlowAction } from '@/lib/sabflow/audit/middleware';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

const RATE_LIMIT_PER_MINUTE = 10;

async function resolveUserId(): Promise<string | null> {
  const session = await getSession();
  if (!session?.user) return null;
  const u = session.user as {
    _id?: string | { toString(): string };
    id?: string;
  };
  const userId = u._id ?? u.id;
  if (!userId) return null;
  return typeof userId === 'string' ? userId : String(userId);
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const userId = await resolveUserId();
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: 'Authentication required' },
      { status: 401 },
    );
  }

  /* Rate limit: 10 tests / minute, scoped to (user, credential). */
  const rateKey = `credtest:${userId}:${id}`;
  const rl = checkRateLimit(rateKey, { maxPerMinute: RATE_LIMIT_PER_MINUTE });
  if (!rl.allowed) {
    const retryAfter = String(rl.retryAfterSeconds ?? 1);
    return NextResponse.json(
      {
        ok: false,
        error: 'Rate limit exceeded',
        retryAfterSeconds: rl.retryAfterSeconds ?? 1,
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(rl.limit),
          'X-RateLimit-Remaining': String(rl.remaining),
          'Retry-After': retryAfter,
        },
      },
    );
  }

  let result;
  try {
    result = await testCredential(id, userId, userId);
  } catch (err) {
    console.error('[SABFLOW CREDENTIALS:TEST] unhandled error', {
      credentialId: id,
      userId,
      err,
    });
    result = {
      ok: false,
      error: `Internal error: ${(err as Error).message}`,
    };
  }

  if (!result.ok) {
    console.warn('[SABFLOW CREDENTIALS:TEST] failed', {
      credentialId: id,
      userId,
      error: result.error,
    });
  }

  /* Audit every attempt (sibling task #7) — fire-and-forget. */
  void recordFlowAction('credential.test', {
    userId,
    target: id,
    metadata: { ok: result.ok, error: result.error },
    request: req,
  });

  const status =
    result.ok
      ? 200
      : result.error === 'Credential not found'
        ? 404
        : result.error === 'Forbidden'
          ? 403
          : 200; /* surface ok:false with 200 so the client can show the message inline */

  return NextResponse.json(result, { status });
}
