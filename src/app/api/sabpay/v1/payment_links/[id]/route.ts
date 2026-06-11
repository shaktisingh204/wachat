import { NextRequest } from 'next/server';

import {
  fromRustError,
  parseJsonBody,
  requireSabpayKey,
} from '@/lib/sabpay/api-route-helpers.server';
import { rustClient } from '@/lib/rust-client';

import { paymentLinkResponse } from '../route';

/**
 * SabPay public API — a single payment link.
 *
 *   GET   /api/sabpay/v1/payment_links/:id   fetch a payment link
 *   PATCH /api/sabpay/v1/payment_links/:id   update mutable fields
 *
 * Auth: `Authorization: Bearer sk_test_…` / `sk_live_…`.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireSabpayKey(req);
  if ('error' in auth) return auth.error;
  const { ctx } = auth;
  const { id } = await params;

  try {
    const link = await rustClient.sabpay.getPaymentLinkAs(
      ctx.userId.toHexString(),
      id,
    );
    return Response.json(paymentLinkResponse(link));
  } catch (err) {
    return fromRustError(err);
  }
}

export async function PATCH(
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

  try {
    const link = await rustClient.sabpay.updatePaymentLinkAs(
      ctx.userId.toHexString(),
      id,
      {
        referenceId:
          typeof body.reference_id === 'string' ? body.reference_id : undefined,
        customerName:
          typeof body.customer_name === 'string' ? body.customer_name : undefined,
        customerEmail:
          typeof body.customer_email === 'string' ? body.customer_email : undefined,
        customerPhone:
          typeof body.customer_phone === 'string' ? body.customer_phone : undefined,
        expireBy: typeof body.expire_by === 'string' ? body.expire_by : undefined,
        notes:
          body.notes && typeof body.notes === 'object'
            ? (body.notes as Record<string, unknown>)
            : undefined,
      },
    );
    return Response.json(paymentLinkResponse(link));
  } catch (err) {
    return fromRustError(err, 'Could not update the payment link.');
  }
}
