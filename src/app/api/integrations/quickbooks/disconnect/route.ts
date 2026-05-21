/**
 * POST /api/integrations/quickbooks/disconnect
 *
 * Clears the tenant's QuickBooks tokens and flips `connected: false`.
 * Returns JSON so the settings page can call it via `fetch`.
 */
import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getSession } from '@/app/actions/user.actions';
import {
  appendSyncLog,
  upsertSettings,
} from '@/lib/integrations/quickbooks/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(): Promise<NextResponse> {
  try {
    const session = await getSession();
    if (!session?.user?._id) {
      return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
    }
    const uidRaw = String(session.user._id);
    if (!ObjectId.isValid(uidRaw)) {
      return NextResponse.json({ ok: false, error: 'invalid user' }, { status: 400 });
    }
    const userId = new ObjectId(uidRaw);

    await upsertSettings(userId, {
      connected: false,
      access_token: undefined,
      refresh_token: undefined,
      expires_at: undefined,
      refresh_token_expires_at: undefined,
      realmId: undefined,
    });
    await appendSyncLog(userId, {
      action: 'disconnect',
      entity: 'connection',
      status: 'success',
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[qbo/disconnect] error:', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
