import { NextRequest } from 'next/server';

import {
  fromRustError,
  parseJsonBody,
  requireSabpayKey,
} from '@/lib/sabpay/api-route-helpers.server';
import { rustClient } from '@/lib/rust-client';
import type { SabpayDispute } from '@/lib/sabpay/types';

/**
 * SabPay public API — contest a dispute.
 *
 *   POST /api/sabpay/v1/disputes/:id/contest
 *     { "summary": "…", "file_urls": ["https://…"] }
 *
 * Submits evidence (a written summary + optional file URLs). The Rust engine,
 * acting as the merchant resolved from the secret key, attaches the evidence
 * and moves the dispute to "under_review".
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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireSabpayKey(req);
  if ('error' in auth) return auth.error;
  const { ctx } = auth;

  const parsed = await parseJsonBody(req);
  if ('error' in parsed) return parsed.error;
  const { body } = parsed;

  const { id } = await params;

  const fileUrlsRaw = body.file_urls;
  const fileUrls =
    Array.isArray(fileUrlsRaw) && fileUrlsRaw.every((u) => typeof u === 'string')
      ? (fileUrlsRaw as string[])
      : undefined;

  try {
    const dispute = await rustClient.sabpay.contestDisputeAs(
      ctx.userId.toHexString(),
      id,
      {
        summary: typeof body.summary === 'string' ? body.summary : '',
        fileUrls,
      },
    );
    return Response.json(disputeResponse(dispute));
  } catch (err) {
    return fromRustError(err, 'Could not contest the dispute.');
  }
}
