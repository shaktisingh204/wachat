import { NextRequest } from 'next/server';

import {
  fromRustError,
  requireSabpayKey,
} from '@/lib/sabpay/api-route-helpers.server';
import { rustClient } from '@/lib/rust-client';

import { qrCodeResponse } from '../../route';

/**
 * SabPay public API — close a QR code.
 *
 *   POST /api/sabpay/v1/qr_codes/:id/close
 *
 * Auth: `Authorization: Bearer sk_test_…` / `sk_live_…`.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireSabpayKey(req);
  if ('error' in auth) return auth.error;
  const { ctx } = auth;
  const { id } = await params;

  try {
    const qr = await rustClient.sabpay.closeQrCodeAs(
      ctx.userId.toHexString(),
      id,
    );
    return Response.json(qrCodeResponse(qr));
  } catch (err) {
    return fromRustError(err, 'Could not close the QR code.');
  }
}
