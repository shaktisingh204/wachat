import { NextRequest } from 'next/server';

import {
  fromRustError,
  requireSabpayKey,
} from '@/lib/sabpay/api-route-helpers.server';
import { rustClient } from '@/lib/rust-client';
import type { SabpayDispute } from '@/lib/sabpay/types';

/**
 * SabPay public API — fetch one dispute.
 *
 *   GET /api/sabpay/v1/disputes/:id
 *
 * Read one chargeback object. Data comes from the Rust engine acting as the
 * merchant resolved from the secret key.
 *
 * Auth: `Authorization: Bearer sk_test_…` / `sk_live_…`.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function disputeResponse(d: SabpayDispute) {
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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireSabpayKey(req);
  if ('error' in auth) return auth.error;
  const { ctx } = auth;

  const { id } = await params;

  try {
    const dispute = await rustClient.sabpay.getDisputeAs(
      ctx.userId.toHexString(),
      id,
    );
    return Response.json(disputeResponse(dispute));
  } catch (err) {
    return fromRustError(err, 'Could not fetch the dispute.');
  }
}
