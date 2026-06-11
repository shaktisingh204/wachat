import { NextRequest } from 'next/server';

import {
  fromRustError,
  requireSabpayKey,
} from '@/lib/sabpay/api-route-helpers.server';
import { rustClient } from '@/lib/rust-client';
import type { SabpayPayment } from '@/lib/sabpay/types';

/**
 * SabPay public API — payments captured against an order.
 *
 *   GET /api/sabpay/v1/orders/:id/payments   list an order's payments
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
    order_id: p.orderId,
    customer_id: p.customerId,
    amount_refunded: p.amountRefunded,
    refund_status: p.refundStatus,
    fee: p.fee,
    tax: p.tax,
    provider_payment_id: p.providerPaymentId,
    failure_reason: p.failureReason,
    created_at: p.createdAt,
    paid_at: p.paidAt,
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
    const { payments } = await rustClient.sabpay.getOrderPaymentsAs(
      ctx.userId.toHexString(),
      id,
    );
    return Response.json({ object: 'list', data: payments.map(paymentResponse) });
  } catch (err) {
    return fromRustError(err, "Could not list the order's payments.");
  }
}
