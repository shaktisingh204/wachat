import { NextRequest } from 'next/server';

import {
  fromRustError,
  requireSabpayKey,
} from '@/lib/sabpay/api-route-helpers.server';
import { rustClient } from '@/lib/rust-client';

import { paymentLinkResponse } from '../../route';

/**
 * SabPay public API — cancel a payment link.
 *
 *   POST /api/sabpay/v1/payment_links/:id/cancel
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
    const link = await rustClient.sabpay.cancelPaymentLinkAs(
      ctx.userId.toHexString(),
      id,
    );
    return Response.json(paymentLinkResponse(link));
  } catch (err) {
    return fromRustError(err, 'Could not cancel the payment link.');
  }
}
