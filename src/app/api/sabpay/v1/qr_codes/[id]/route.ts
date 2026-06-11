import { NextRequest } from 'next/server';

import {
  fromRustError,
  requireSabpayKey,
} from '@/lib/sabpay/api-route-helpers.server';
import { rustClient } from '@/lib/rust-client';

import { qrCodeResponse } from '../route';

/**
 * SabPay public API — a single QR code.
 *
 *   GET /api/sabpay/v1/qr_codes/:id   fetch a QR code
 *
 * Auth: `Authorization: Bearer sk_test_…` / `sk_live_…`.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireSabpayKey(req);
  if ('error' in auth) return auth.error;
  const { ctx } = auth;
  const { id } = await params;

  try {
    const qr = await rustClient.sabpay.getQrCodeAs(ctx.userId.toHexString(), id);
    return Response.json(qrCodeResponse(qr));
  } catch (err) {
    return fromRustError(err);
  }
}
