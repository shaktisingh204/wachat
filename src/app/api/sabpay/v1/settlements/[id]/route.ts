import { NextRequest } from 'next/server';

import {
  fromRustError,
  requireSabpayKey,
} from '@/lib/sabpay/api-route-helpers.server';
import { rustClient } from '@/lib/rust-client';
import type { SabpayPayment, SabpaySettlement } from '@/lib/sabpay/types';
import type { SabpaySettlementRefund } from '@/lib/rust-client/sabpay';

/**
 * SabPay public API — fetch one settlement (with its payments + refunds).
 *
 *   GET /api/sabpay/v1/settlements/:id
 *
 * Read-only. Data comes from the Rust engine acting as the merchant resolved
 * from the secret key.
 *
 * Auth: `Authorization: Bearer sk_test_…` / `sk_live_…`.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function settlementResponse(s: SabpaySettlement) {
  return {
    id: s.id,
    object: 'settlement',
    mode: s.mode,
    status: s.status,
    gross_amount: s.grossAmount,
    fees_total: s.feesTotal,
    tax_total: s.taxTotal,
    refunds_total: s.refundsTotal,
    disputes_deducted: s.disputesDeducted,
    amount: s.amount,
    payment_count: s.paymentCount,
    refund_count: s.refundCount,
    utr: s.utr,
    period_end: s.periodEnd,
    settled_at: s.settledAt,
    created_at: s.createdAt,
  };
}

function settlementPaymentResponse(p: SabpayPayment) {
  return {
    id: p.id,
    object: 'payment',
    mode: p.mode,
    status: p.status,
    amount: p.amount,
    currency: p.currency,
    description: p.description,
    created_at: p.createdAt,
    paid_at: p.paidAt,
  };
}

function settlementRefundResponse(r: SabpaySettlementRefund) {
  return {
    id: r.id,
    object: 'refund',
    amount: r.amount,
    payment_id: r.paymentId,
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
    const { settlement, payments, refunds } =
      await rustClient.sabpay.getSettlementAs(ctx.userId.toHexString(), id);
    return Response.json({
      ...settlementResponse(settlement),
      payments: payments.map(settlementPaymentResponse),
      refunds: refunds.map(settlementRefundResponse),
    });
  } catch (err) {
    return fromRustError(err, 'Could not fetch the settlement.');
  }
}
