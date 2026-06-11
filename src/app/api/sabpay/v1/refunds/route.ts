import { NextRequest } from 'next/server';

import {
  fromRustError,
  listQuery,
  requireSabpayKey,
} from '@/lib/sabpay/api-route-helpers.server';
import { rustClient } from '@/lib/rust-client';
import type { SabpayRefund } from '@/lib/sabpay/types';

/**
 * SabPay public API — refunds.
 *
 *   GET /api/sabpay/v1/refunds   list refunds (newest first)
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export function refundResponse(r: SabpayRefund) {
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

export async function GET(req: NextRequest) {
  const auth = await requireSabpayKey(req);
  if ('error' in auth) return auth.error;
  const { ctx } = auth;

  const { limit, before, status } = listQuery(req);

  try {
    const { refunds } = await rustClient.sabpay.listRefundsAs(
      ctx.userId.toHexString(),
      { mode: ctx.mode, status, limit, before },
    );
    return Response.json({ object: 'list', data: refunds.map(refundResponse) });
  } catch (err) {
    return fromRustError(err, 'Could not list refunds.');
  }
}
