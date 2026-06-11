import { NextRequest } from 'next/server';

import {
  sabpayApiError,
  verifySabpayApiKey,
} from '@/lib/sabpay/api-auth.server';
import {
  createPayment,
  listPayments,
  type CreatePaymentInput,
} from '@/lib/sabpay/db.server';
import { dispatchSabpayEvent } from '@/lib/sabpay/webhooks.server';
import type { SabpayPaymentStatus } from '@/lib/sabpay/types';

/**
 * SabPay public API — payments.
 *
 *   POST /api/sabpay/v1/payments   create a payment session → checkout_url
 *   GET  /api/sabpay/v1/payments   list payments (newest first)
 *
 * Auth: `Authorization: Bearer sk_test_…` / `sk_live_…`. The key prefix
 * decides the mode, so test keys can never create live charges.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const ctx = await verifySabpayApiKey(req);
  if (!ctx) {
    return sabpayApiError(
      401,
      'invalid_api_key',
      'Provide a valid secret key in the Authorization header: Bearer sk_test_…',
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return sabpayApiError(400, 'invalid_json', 'Request body must be JSON.');
  }

  const input: CreatePaymentInput = {
    amount: body.amount as number,
    currency: typeof body.currency === 'string' ? body.currency : undefined,
    description:
      typeof body.description === 'string' ? body.description : undefined,
    customer:
      body.customer && typeof body.customer === 'object'
        ? (body.customer as CreatePaymentInput['customer'])
        : undefined,
    metadata:
      body.metadata && typeof body.metadata === 'object'
        ? (body.metadata as Record<string, string>)
        : undefined,
    successUrl:
      typeof body.success_url === 'string' ? body.success_url : undefined,
    cancelUrl:
      typeof body.cancel_url === 'string' ? body.cancel_url : undefined,
  };

  try {
    const payment = await createPayment(ctx.userId, ctx.mode, input);
    void dispatchSabpayEvent(ctx.userId, 'payment.created', payment);
    return Response.json(
      {
        id: payment.id,
        object: 'payment',
        mode: payment.mode,
        status: payment.status,
        amount: payment.amount,
        currency: payment.currency,
        description: payment.description,
        checkout_url: payment.checkoutUrl,
        success_url: payment.successUrl,
        cancel_url: payment.cancelUrl,
        customer: payment.customer,
        metadata: payment.metadata ?? {},
        created_at: payment.createdAt,
      },
      { status: 201 },
    );
  } catch (err) {
    return sabpayApiError(
      400,
      'invalid_request',
      err instanceof Error ? err.message : 'Could not create the payment.',
    );
  }
}

export async function GET(req: NextRequest) {
  const ctx = await verifySabpayApiKey(req);
  if (!ctx) {
    return sabpayApiError(
      401,
      'invalid_api_key',
      'Provide a valid secret key in the Authorization header: Bearer sk_test_…',
    );
  }

  const url = new URL(req.url);
  const statusParam = url.searchParams.get('status');
  const status: SabpayPaymentStatus | undefined =
    statusParam === 'created' || statusParam === 'succeeded' || statusParam === 'failed'
      ? statusParam
      : undefined;
  const limit = Number.parseInt(url.searchParams.get('limit') ?? '25', 10) || 25;
  const before = url.searchParams.get('before') ?? undefined;

  const payments = await listPayments(ctx.userId, {
    mode: ctx.mode,
    status,
    limit,
    before,
  });

  return Response.json({
    object: 'list',
    data: payments.map((p) => ({
      id: p.id,
      object: 'payment',
      mode: p.mode,
      status: p.status,
      amount: p.amount,
      currency: p.currency,
      description: p.description,
      checkout_url: p.checkoutUrl,
      customer: p.customer,
      metadata: p.metadata ?? {},
      provider_payment_id: p.providerPaymentId,
      failure_reason: p.failureReason,
      created_at: p.createdAt,
      paid_at: p.paidAt,
    })),
  });
}
