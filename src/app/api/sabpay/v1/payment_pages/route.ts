import { NextRequest } from 'next/server';

import {
  fromRustError,
  listQuery,
  parseJsonBody,
  requireSabpayKey,
  withIdempotency,
} from '@/lib/sabpay/api-route-helpers.server';
import { rustClient } from '@/lib/rust-client';
import type { SabpayPaymentPage, SabpayPaymentPageField } from '@/lib/sabpay/types';

/**
 * SabPay public API — payment pages.
 *
 *   POST /api/sabpay/v1/payment_pages   create a no-code hosted page
 *   GET  /api/sabpay/v1/payment_pages   list payment pages (newest first)
 *
 * Auth: `Authorization: Bearer sk_test_…` / `sk_live_…`.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export function paymentPageResponse(p: SabpayPaymentPage) {
  return {
    id: p.id,
    object: 'payment_page',
    mode: p.mode,
    title: p.title,
    description: p.description,
    slug: p.slug,
    amount_type: p.amountType,
    amount: p.amount,
    min_amount: p.minAmount,
    fields: p.fields,
    branding_image_url: p.brandingImageUrl,
    active: p.active,
    url: p.url,
    created_at: p.createdAt,
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
    const page = await rustClient.sabpay.createPaymentPageAs(
      ctx.userId.toHexString(),
      {
        title: body.title as string,
        description:
          typeof body.description === 'string' ? body.description : undefined,
        slug: body.slug as string,
        amountType: body.amount_type as string,
        amount: typeof body.amount === 'number' ? body.amount : undefined,
        minAmount:
          typeof body.min_amount === 'number' ? body.min_amount : undefined,
        fields: Array.isArray(body.fields)
          ? (body.fields as SabpayPaymentPageField[])
          : undefined,
        brandingImageUrl:
          typeof body.branding_image_url === 'string'
            ? body.branding_image_url
            : undefined,
        mode: ctx.mode,
      },
    );
    return { status: 201, body: paymentPageResponse(page) };
  }, 'Could not create the payment page.');
}

export async function GET(req: NextRequest) {
  const auth = await requireSabpayKey(req);
  if ('error' in auth) return auth.error;
  const { ctx } = auth;

  const { limit, before } = listQuery(req);

  try {
    const { pages } = await rustClient.sabpay.listPaymentPagesAs(
      ctx.userId.toHexString(),
      { mode: ctx.mode, limit, before },
    );
    return Response.json({
      object: 'list',
      data: pages.map(paymentPageResponse),
    });
  } catch (err) {
    return fromRustError(err);
  }
}
