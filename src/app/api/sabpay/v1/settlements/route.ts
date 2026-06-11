import { NextRequest } from 'next/server';

import {
  fromRustError,
  listQuery,
  requireSabpayKey,
} from '@/lib/sabpay/api-route-helpers.server';
import { rustClient } from '@/lib/rust-client';
import type { SabpaySettlement } from '@/lib/sabpay/types';

/**
 * SabPay public API — settlements.
 *
 *   GET /api/sabpay/v1/settlements   list settlements (newest first)
 *
 * Read-only payout objects (always live mode). The Rust engine, acting as the
 * merchant resolved from the secret key, owns every settlement record.
 *
 * Auth: `Authorization: Bearer sk_test_…` / `sk_live_…`.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export function settlementResponse(s: SabpaySettlement) {
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

export async function GET(req: NextRequest) {
  const auth = await requireSabpayKey(req);
  if ('error' in auth) return auth.error;
  const { ctx } = auth;

  const { limit, before } = listQuery(req);

  try {
    const { settlements } = await rustClient.sabpay.listSettlementsAs(
      ctx.userId.toHexString(),
      { mode: ctx.mode, limit, before },
    );
    return Response.json({
      object: 'list',
      data: settlements.map(settlementResponse),
    });
  } catch (err) {
    return fromRustError(err, 'Could not list settlements.');
  }
}
