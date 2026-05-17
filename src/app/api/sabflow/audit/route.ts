/**
 * SabFlow audit log — GET endpoint.
 *
 *   GET /api/sabflow/audit?limit=50&skip=0&action=flow.updated&flowId=xxx
 *     → { entries: AuditEntry[]; total: number }
 *
 * Auth-gated by session.  Always scoped to the caller's userId — there
 * is no cross-workspace read path here.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/app/actions/user.actions';
import { listAudit } from '@/lib/sabflow/audit/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function resolveUserId(): Promise<string | null> {
  const session = await getSession();
  if (!session?.user) return null;
  const u = session.user as { _id?: { toString(): string }; id?: string };
  return u._id?.toString() ?? u.id ?? null;
}

export async function GET(req: NextRequest) {
  const userId = await resolveUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limitRaw = Number(searchParams.get('limit') ?? '50');
  const skipRaw = Number(searchParams.get('skip') ?? '0');
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;
  const skip = Number.isFinite(skipRaw) ? Math.max(skipRaw, 0) : 0;
  const action = searchParams.get('action') ?? undefined;
  const flowId = searchParams.get('flowId') ?? undefined;

  try {
    const { entries, total } = await listAudit(userId, {
      limit,
      skip,
      action: action || undefined,
      flowId: flowId || undefined,
    });
    return NextResponse.json({ entries, total });
  } catch (err) {
    console.error('[SABFLOW AUDIT] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
