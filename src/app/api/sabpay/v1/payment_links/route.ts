import { NextRequest } from 'next/server';

import {
  fromRustError,
  listQuery,
  parseJsonBody,
  requireSabpayKey,
  withIdempotency,
} from '@/lib/sabpay/api-route-helpers.server';
import { rustClient } from '@/lib/rust-client';
import type { SabpayPaymentLink } from '@/lib/sabpay/types';

/**
 * SabPay public API — payment links.
 *
 *   POST /api/sabpay/v1/payment_links   create a hosted payment link
 *   GET  /api/sabpay/v1/payment_links   list payment links (newest first)
 *
 * Auth: `Authorization: Bearer sk_test_…` / `sk_live_…`. The key prefix
 * decides the mode, so test keys can never create live links.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export function paymentLinkResponse(l: SabpayPaymentLink) {
  return {
    id: l.id,
    object: 'payment_link',
    mode: l.mode,
    status: l.status,
    amount: l.amount,
    currency: l.currency,
    description: l.description,
    reference_id: l.referenceId,
    customer_name: l.customerName,
    customer_email: l.customerEmail,
    customer_phone: l.customerPhone,
    notes: l.notes ?? {},
    short_url: l.shortUrl,
    expire_by: l.expireBy,
    payment_id: l.paymentId,
    created_at: l.createdAt,
    paid_at: l.paidAt,
    cancelled_at: l.cancelledAt,
  };
}

export async function POST(req: NextRequest) {
  const auth = await requireSabpayKey(req);
  if ('error' in auth) return auth.error;
  const { ctx } = auth;

  const parsed = await parseJsonBody(req);
  if ('error' in parsed) return parsed.error;
  const { body } = parsed;

  return withIdempotency(req, ctx, body, async () => {
    const link = await rustClient.sabpay.createPaymentLinkAs(
      ctx.userId.toHexString(),
      {
        amount: body.amount as number,
        currency: typeof body.currency === 'string' ? body.currency : undefined,
        description:
          typeof body.description === 'string' ? body.description : undefined,
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
        mode: ctx.mode,
      },
    );
    return { status: 201, body: paymentLinkResponse(link) };
  }, 'Could not create the payment link.');
}

export async function GET(req: NextRequest) {
  const auth = await requireSabpayKey(req);
  if ('error' in auth) return auth.error;
  const { ctx } = auth;

  const { limit, before, status } = listQuery(req);

  try {
    const { paymentLinks } = await rustClient.sabpay.listPaymentLinksAs(
      ctx.userId.toHexString(),
      { mode: ctx.mode, status, limit, before },
    );
    return Response.json({
      object: 'list',
      data: paymentLinks.map(paymentLinkResponse),
    });
  } catch (err) {
    return fromRustError(err);
  }
}
