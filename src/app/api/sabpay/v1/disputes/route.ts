import { NextRequest } from 'next/server';

import {
  fromRustError,
  listQuery,
  requireSabpayKey,
} from '@/lib/sabpay/api-route-helpers.server';
import { rustClient } from '@/lib/rust-client';
import type { SabpayDispute } from '@/lib/sabpay/types';

/**
 * SabPay public API — disputes.
 *
 *   GET /api/sabpay/v1/disputes   list disputes (newest first)
 *
 * Chargeback objects owned by the Rust engine, acting as the merchant resolved
 * from the secret key.
 *
 * Auth: `Authorization: Bearer sk_test_…` / `sk_live_…`.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export function disputeResponse(d: SabpayDispute) {
  return {
    id: d.id,
    object: 'dispute',
    mode: d.mode,
    payment_id: d.paymentId,
    amount: d.amount,
    currency: d.currency,
    reason_code: d.reasonCode,
    phase: d.phase,
    status: d.status,
    respond_by: d.respondBy,
    evidence: d.evidence
      ? { summary: d.evidence.summary, file_urls: d.evidence.fileUrls }
      : null,
    evidence_submitted_at: d.evidenceSubmittedAt,
    created_at: d.createdAt,
    resolved_at: d.resolvedAt,
  };
}

export async function GET(req: NextRequest) {
  const auth = await requireSabpayKey(req);
  if ('error' in auth) return auth.error;
  const { ctx } = auth;

  const { limit, before, status } = listQuery(req);

  try {
    const { disputes } = await rustClient.sabpay.listDisputesAs(
      ctx.userId.toHexString(),
      { mode: ctx.mode, status, limit, before },
    );
    return Response.json({
      object: 'list',
      data: disputes.map(disputeResponse),
    });
  } catch (err) {
    return fromRustError(err, 'Could not list disputes.');
  }
}
