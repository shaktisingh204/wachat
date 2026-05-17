/**
 * SabFlow API-key management.
 *
 *   GET    /api/sabflow/api-keys              — list caller's keys (no raw key)
 *   POST   /api/sabflow/api-keys              body: { label } → { id, rawKey, prefix }
 *
 * The raw key is shown exactly once — clients must store it.  The DB only
 * holds the SHA-256 hash.  See lib/sabflow/apiKeys/db.ts for the store.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/app/actions/user.actions';
import { createApiKey, listApiKeys } from '@/lib/sabflow/apiKeys/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function resolveUserId(): Promise<string | null> {
  const session = await getSession();
  if (!session?.user) return null;
  const u = session.user as { _id?: { toString(): string }; id?: string };
  return u._id?.toString() ?? u.id ?? null;
}

export async function GET() {
  const userId = await resolveUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  try {
    const keys = await listApiKeys(userId);
    return NextResponse.json({ keys });
  } catch (err) {
    console.error('[SABFLOW API-KEYS LIST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const userId = await resolveUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as { label?: string };
  const label = (body.label ?? '').toString().trim() || 'Untitled key';
  if (label.length > 80) {
    return NextResponse.json({ error: 'Label too long (max 80 chars)' }, { status: 400 });
  }

  try {
    const minted = await createApiKey(userId, label);
    console.log(`[SABFLOW API-KEYS] minted user=${userId} prefix=${minted.prefix}`);
    return NextResponse.json(minted, { status: 201 });
  } catch (err) {
    console.error('[SABFLOW API-KEYS CREATE]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
