import { NextRequest } from 'next/server';

import {
  fromRustError,
  parseJsonBody,
  requireSabpayKey,
} from '@/lib/sabpay/api-route-helpers.server';
import { rustClient } from '@/lib/rust-client';
import type { SabpayPaymentPageField } from '@/lib/sabpay/types';

import { paymentPageResponse } from '../route';

/**
 * SabPay public API — a single payment page.
 *
 *   GET    /api/sabpay/v1/payment_pages/:id   fetch a payment page
 *   PATCH  /api/sabpay/v1/payment_pages/:id   update mutable fields
 *   DELETE /api/sabpay/v1/payment_pages/:id   delete a payment page
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
    const page = await rustClient.sabpay.getPaymentPageAs(
      ctx.userId.toHexString(),
      id,
    );
    return Response.json(paymentPageResponse(page));
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
    const page = await rustClient.sabpay.updatePaymentPageAs(
      ctx.userId.toHexString(),
      id,
      {
        title: typeof body.title === 'string' ? body.title : undefined,
        description:
          typeof body.description === 'string' ? body.description : undefined,
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
        active: typeof body.active === 'boolean' ? body.active : undefined,
      },
    );
    return Response.json(paymentPageResponse(page));
  } catch (err) {
    return fromRustError(err, 'Could not update the payment page.');
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireSabpayKey(req);
  if ('error' in auth) return auth.error;
  const { ctx } = auth;
  const { id } = await params;

  try {
    await rustClient.sabpay.deletePaymentPageAs(ctx.userId.toHexString(), id);
    return Response.json({ id, object: 'payment_page', deleted: true });
  } catch (err) {
    return fromRustError(err, 'Could not delete the payment page.');
  }
}
