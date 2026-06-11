import { NextRequest } from 'next/server';

import {
  parseJsonBody,
  requireSabpayKey,
  withIdempotency,
} from '@/lib/sabpay/api-route-helpers.server';
import { rustClient } from '@/lib/rust-client';
import type { SabpayRefund } from '@/lib/sabpay/types';

/**
 * SabPay public API — refund a payment.
 *
 *   POST /api/sabpay/v1/payments/:id/refund   refund (full or partial)
 *
 * Omit `amount` for a full refund of the remaining balance. Rust stamps the
 * fee reversal and fans out the `refund.created` webhook.
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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireSabpayKey(req);
  if ('error' in auth) return auth.error;
  const { ctx } = auth;

  const { id } = await params;

  const parsed = await parseJsonBody(req);
  if ('error' in parsed) return parsed.error;
  const { body } = parsed;

  return withIdempotency(req, ctx, body, async () => {
    const refund = await rustClient.sabpay.createRefundAs(
      ctx.userId.toHexString(),
      id,
      {
        amount: typeof body.amount === 'number' ? body.amount : undefined,
        reason: typeof body.reason === 'string' ? body.reason : undefined,
        notes:
          body.notes && typeof body.notes === 'object'
            ? (body.notes as Record<string, unknown>)
            : undefined,
      },
    );
    return { status: 201, body: refundResponse(refund) };
  }, 'Could not create the refund.');
}
