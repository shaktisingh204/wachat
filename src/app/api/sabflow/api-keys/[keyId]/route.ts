/**
 * DELETE /api/sabflow/api-keys/[keyId] — revoke a key.  Only the owner may
 * revoke.  Returns 404 when the key doesn't exist (or wasn't yours).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/app/actions/user.actions';
import { revokeApiKey } from '@/lib/sabflow/apiKeys/db';
import { recordFlowAction } from '@/lib/sabflow/audit/middleware';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ keyId: string }> },
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const userId = (session.user as { _id: { toString(): string } })._id.toString();

  const { keyId } = await ctx.params;
  try {
    const ok = await revokeApiKey(userId, keyId);
    if (!ok) {
      return NextResponse.json({ error: 'Key not found' }, { status: 404 });
    }
    console.log(`[SABFLOW API-KEYS] revoked user=${userId} key=${keyId}`);
    void recordFlowAction('apiKey.revoked', {
      userId,
      target: keyId,
      request: _req,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[SABFLOW API-KEYS DELETE]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
