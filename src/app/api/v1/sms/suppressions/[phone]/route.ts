import { NextResponse, type NextRequest } from 'next/server';

import { hashPhone, isPhoneHash } from '@/app/sabsms/suppressions/lib';
import { withSabsmsApi } from '@/lib/sabsms/apikeys/http';
import { getSabsmsCollections } from '@/lib/sabsms/db/collections';

/**
 * Public API — `DELETE /api/v1/sms/suppressions/:phone`.
 *
 * `:phone` may be the E.164 number (URL-encoded `+`) or the sha-256
 * phone hash itself. Idempotent: deleting an absent row returns
 * `{ removed: false }` with 200.
 */
export const DELETE = withSabsmsApi<{ phone: string }>(
  'messages:send',
  async (_req: NextRequest, { auth, params }) => {
    const raw = decodeURIComponent(params.phone ?? '').trim();
    const phoneHash = isPhoneHash(raw) ? raw : hashPhone(raw);

    const { cols } = await getSabsmsCollections();
    const res = await cols.suppressions.deleteOne({
      workspaceId: auth.workspaceId,
      phoneHash,
    });
    return NextResponse.json({ removed: res.deletedCount === 1 });
  },
);
