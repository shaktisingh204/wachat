import { NextRequest } from 'next/server';

import {
  sabpayApiError,
  verifySabpayApiKey,
} from '@/lib/sabpay/api-auth.server';
import { rustClient } from '@/lib/rust-client';
import { RustApiError } from '@/lib/rust-client/fetcher';
import type { SabpayPayment, SabpayPaymentStatus } from '@/lib/sabpay/types';

/**
 * SabPay public API — payments.
 *
 *   POST /api/sabpay/v1/payments   create a payment session → checkout_url
 *   GET  /api/sabpay/v1/payments   list payments (newest first)
 *
 * Auth: `Authorization: Bearer sk_test_…` / `sk_live_…`. The key prefix
 * decides the mode, so test keys can never create live charges. The key is
 * resolved here (against the shared `sabpay_api_keys` collection), then the
 * data operation is performed by the Rust engine acting as the merchant's
 * user id — the Rust side also fans out the `payment.created` webhook.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function paymentResponse(p: SabpayPayment) {
  return {
    id: p.id,
    object: 'payment',
    mode: p.mode,
    status: p.status,
    amount: p.amount,
    currency: p.currency,
    description: p.description,
    checkout_url: p.checkoutUrl,
    success_url: p.successUrl,
    cancel_url: p.cancelUrl,
    customer: p.customer,
    metadata: p.metadata ?? {},
    provider_payment_id: p.providerPaymentId,
    failure_reason: p.failureReason,
    created_at: p.createdAt,
    paid_at: p.paidAt,
  };
}

function fromRustError(err: unknown): Response {
  if (err instanceof RustApiError) {
    const status = err.status >= 400 ? err.status : 400;
    const code = status >= 500 ? 'server_error' : 'invalid_request';
    return sabpayApiError(status, code, err.message);
  }
  return sabpayApiError(
    400,
    'invalid_request',
    err instanceof Error ? err.message : 'Could not create the payment.',
  );
}

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

  try {
    const payment = await rustClient.sabpay.createPaymentAs(ctx.userId.toHexString(), {
      amount: body.amount as number,
      currency: typeof body.currency === 'string' ? body.currency : undefined,
      description:
        typeof body.description === 'string' ? body.description : undefined,
      customer:
        body.customer && typeof body.customer === 'object'
          ? (body.customer as { name?: string; email?: string; phone?: string })
          : undefined,
      metadata:
        body.metadata && typeof body.metadata === 'object'
          ? (body.metadata as Record<string, string>)
          : undefined,
      successUrl:
        typeof body.success_url === 'string' ? body.success_url : undefined,
      cancelUrl:
        typeof body.cancel_url === 'string' ? body.cancel_url : undefined,
      mode: ctx.mode,
    });
    return Response.json(paymentResponse(payment), { status: 201 });
  } catch (err) {
    return fromRustError(err);
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

  try {
    const { payments } = await rustClient.sabpay.listPaymentsAs(
      ctx.userId.toHexString(),
      { mode: ctx.mode, status, limit, before },
    );
    return Response.json({
      object: 'list',
      data: payments.map(paymentResponse),
    });
  } catch (err) {
    return fromRustError(err);
  }
}
