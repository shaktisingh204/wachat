/**
 * API-key auth middleware for the /api/v1/* SabFlow routes.
 *
 * Accepts either:
 *   - `Authorization: Bearer sk_live_...`     (preferred)
 *   - `X-API-Key: sk_live_...`                (compat)
 *
 * Returns the resolved `userId` on success, or a NextResponse with the right
 * 401/400 already constructed.  Callers do:
 *
 *   const auth = await authenticateApiRequest(req);
 *   if (auth instanceof NextResponse) return auth;
 *   const userId = auth.userId;
 *   …
 */

import { NextResponse, type NextRequest } from 'next/server';
import { resolveApiKey } from './db';

export type AuthSuccess = { userId: string; rawKey: string };

export async function authenticateApiRequest(
  req: NextRequest,
): Promise<AuthSuccess | NextResponse> {
  const rawKey = extractKey(req);
  if (!rawKey) {
    return NextResponse.json(
      {
        error: 'Missing API key',
        hint: 'Send Authorization: Bearer <key> or X-API-Key: <key>',
      },
      { status: 401 },
    );
  }

  const userId = await resolveApiKey(rawKey);
  if (!userId) {
    return NextResponse.json(
      { error: 'Invalid or revoked API key' },
      { status: 401 },
    );
  }

  return { userId, rawKey };
}

function extractKey(req: NextRequest): string | null {
  const auth = req.headers.get('authorization');
  if (auth) {
    const m = /^Bearer\s+(.+)$/i.exec(auth.trim());
    if (m) return m[1].trim();
  }
  const xKey = req.headers.get('x-api-key');
  if (xKey) return xKey.trim();
  return null;
}
