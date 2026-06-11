import { NextRequest } from 'next/server';

import {
  fromRustError,
  requireSabpayKey,
} from '@/lib/sabpay/api-route-helpers.server';
import { rustClient } from '@/lib/rust-client';
import type { SabpayRefund } from '@/lib/sabpay/types';

/**
 * SabPay public API — single refund.
 *
 *   GET /api/sabpay/v1/refunds/:id   retrieve a refund
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function refundResponse(r: SabpayRefund) {
  return {
    id: r.id,
    object: 'refund',
    mode: r.mode,
    payment_id: r.paymentId,
    amount: r.amount,
    currency: r.currency,
    status: r.status,
    reason: r.reason,
    notes: r.notes ?? {},
    settlement_id: r.settlementId,
    created_at: r.createdAt,
    processed_at: r.processedAt,
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireSabpayKey(req);
  if ('error' in auth) return auth.error;
  const { ctx } = auth;

  const { id } = await params;

  try {
    const refund = await rustClient.sabpay.getRefundAs(
      ctx.userId.toHexString(),
      id,
    );
    return Response.json(refundResponse(refund));
  } catch (err) {
    return fromRustError(err, 'Could not retrieve the refund.');
  }
}
