import { NextRequest } from 'next/server';

import {
  requireSabpayKey,
  fromRustError,
} from '@/lib/sabpay/api-route-helpers.server';
import { rustClient } from '@/lib/rust-client';
import type {
  SabpayInvoice,
  SabpayLineItem,
} from '@/lib/sabpay/types';

/**
 * SabPay public API — issue a draft invoice.
 *
 *   POST /api/sabpay/v1/invoices/:id/issue
 *
 * Finalizes the draft and produces a hosted-checkout `short_url`.
 *
 * Auth: `Authorization: Bearer sk_test_…` / `sk_live_…`.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function lineItemResponse(li: SabpayLineItem) {
  return {
    name: li.name,
    description: li.description,
    amount: li.amount,
    quantity: li.quantity,
  };
}

function invoiceResponse(inv: SabpayInvoice) {
  return {
    id: inv.id,
    object: 'invoice',
    mode: inv.mode,
    type: inv.type,
    status: inv.status,
    customer_id: inv.customerId,
    customer_name: inv.customerName,
    customer_email: inv.customerEmail,
    customer_phone: inv.customerPhone,
    line_items: inv.lineItems.map(lineItemResponse),
    amount: inv.amount,
    currency: inv.currency,
    notes: inv.notes ?? {},
    expire_by: inv.expireBy,
    payment_id: inv.paymentId,
    subscription_id: inv.subscriptionId,
    short_url: inv.shortUrl,
    created_at: inv.createdAt,
    issued_at: inv.issuedAt,
    paid_at: inv.paidAt,
    cancelled_at: inv.cancelledAt,
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

  try {
    const invoice = await rustClient.sabpay.issueInvoiceAs(
      ctx.userId.toHexString(),
      id,
    );
    return Response.json(invoiceResponse(invoice));
  } catch (err) {
    return fromRustError(err);
  }
}
