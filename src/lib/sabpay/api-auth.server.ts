import 'server-only';

/**
 * SabPay public API authentication.
 *
 * Merchants call `/api/sabpay/v1/*` with their secret key:
 *
 *   Authorization: Bearer sk_test_…     (or sk_live_…)
 *
 * The key's prefix decides the mode — exactly like the major gateways —
 * so a test key can never create a live charge. Keys are stored as
 * SHA-256 hashes in `sabpay_api_keys` (see db.server.ts).
 */

import type { NextRequest } from 'next/server';
import type { ObjectId } from 'mongodb';

import { findApiKeyBySecret } from './db.server';
import type { SabpayMode } from './types';

export interface SabpayApiContext {
  userId: ObjectId;
  keyId: string;
  mode: SabpayMode;
}

function extractSecret(req: NextRequest): string | null {
  const auth = req.headers.get('authorization');
  if (auth?.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  const headerKey = req.headers.get('x-api-key');
  if (headerKey?.trim()) return headerKey.trim();
  return null;
}

/** Resolves the request's secret key, or null when missing/invalid/revoked. */
export async function verifySabpayApiKey(
  req: NextRequest,
): Promise<SabpayApiContext | null> {
  const secret = extractSecret(req);
  if (!secret) return null;
  const doc = await findApiKeyBySecret(secret);
  if (!doc) return null;
  return {
    userId: doc.userId,
    keyId: doc._id.toHexString(),
    mode: doc.mode,
  };
}

/** Stripe-style error body so merchant SDK code reads naturally. */
export function sabpayApiError(
  status: number,
  code: string,
  message: string,
): Response {
  return Response.json(
    { error: { code, message } },
    { status },
  );
}
