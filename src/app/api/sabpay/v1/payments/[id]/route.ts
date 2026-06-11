import { NextRequest } from 'next/server';

import {
  sabpayApiError,
  verifySabpayApiKey,
} from '@/lib/sabpay/api-auth.server';
import { rustClient } from '@/lib/rust-client';
import { RustApiError } from '@/lib/rust-client/fetcher';

/**
 * SabPay public API — fetch one payment.
 *
 *   GET /api/sabpay/v1/payments/:id
 *
 * Merchants poll this (or wait for the webhook) after the customer is
 * redirected back, to confirm the final status server-side. Data comes from
 * the Rust engine acting as the merchant resolved from the secret key.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await verifySabpayApiKey(req);
  if (!ctx) {
    return sabpayApiError(
      401,
      'invalid_api_key',
      'Provide a valid secret key in the Authorization header: Bearer sk_test_…',
    );
  }

  const { id } = await params;
  try {
    const p = await rustClient.sabpay.getPaymentAs(ctx.userId.toHexString(), id);
    if (p.mode !== ctx.mode) {
      return sabpayApiError(404, 'payment_not_found', `No payment "${id}".`);
    }
    return Response.json({
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
      provider_meta: p.providerMeta,
      failure_reason: p.failureReason,
      created_at: p.createdAt,
      paid_at: p.paidAt,
    });
  } catch (err) {
    if (err instanceof RustApiError && err.status === 404) {
      return sabpayApiError(404, 'payment_not_found', `No payment "${id}".`);
    }
    if (err instanceof RustApiError) {
      return sabpayApiError(err.status, 'server_error', err.message);
    }
    return sabpayApiError(500, 'server_error', 'Could not fetch the payment.');
  }
}
