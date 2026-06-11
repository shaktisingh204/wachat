import { NextRequest } from 'next/server';

import {
  requireSabpayKey,
  parseJsonBody,
  fromRustError,
  listQuery,
  withIdempotency,
} from '@/lib/sabpay/api-route-helpers.server';
import { rustClient } from '@/lib/rust-client';
import type {
  SabpayInvoice,
  SabpayLineItem,
} from '@/lib/sabpay/types';
import type { SabpayInvoiceLineItemInput } from '@/lib/rust-client/sabpay';

/**
 * SabPay public API — invoices.
 *
 *   POST /api/sabpay/v1/invoices   create a draft invoice
 *   GET  /api/sabpay/v1/invoices   list invoices (newest first)
 *
 * Auth: `Authorization: Bearer sk_test_…` / `sk_live_…`. The data operation
 * is performed by the Rust engine acting as the merchant's user id.
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

function parseLineItems(value: unknown): SabpayInvoiceLineItemInput[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((li): li is Record<string, unknown> => !!li && typeof li === 'object')
    .map((li) => ({
      name: li.name as string,
      description:
        typeof li.description === 'string' ? li.description : undefined,
      amount: li.amount as number,
      quantity: typeof li.quantity === 'number' ? li.quantity : undefined,
    }));
}

export async function POST(req: NextRequest) {
  const auth = await requireSabpayKey(req);
  if ('error' in auth) return auth.error;
  const { ctx } = auth;

  const parsed = await parseJsonBody(req);
  if ('error' in parsed) return parsed.error;
  const { body } = parsed;

  return withIdempotency(req, ctx, body, async () => {
    const invoice = await rustClient.sabpay.createInvoiceAs(
      ctx.userId.toHexString(),
      {
        customerId:
          typeof body.customer_id === 'string' ? body.customer_id : undefined,
        customerName:
          typeof body.customer_name === 'string' ? body.customer_name : undefined,
        customerEmail:
          typeof body.customer_email === 'string' ? body.customer_email : undefined,
        customerPhone:
          typeof body.customer_phone === 'string' ? body.customer_phone : undefined,
        lineItems: parseLineItems(body.line_items),
        currency: typeof body.currency === 'string' ? body.currency : undefined,
        notes:
          body.notes && typeof body.notes === 'object'
            ? (body.notes as Record<string, unknown>)
            : undefined,
        expireBy: typeof body.expire_by === 'string' ? body.expire_by : undefined,
        mode: ctx.mode,
      },
    );
    return { status: 201, body: invoiceResponse(invoice) };
  });
}

export async function GET(req: NextRequest) {
  const auth = await requireSabpayKey(req);
  if ('error' in auth) return auth.error;
  const { ctx } = auth;

  const { limit, before, status } = listQuery(req);

  try {
    const { invoices } = await rustClient.sabpay.listInvoicesAs(
      ctx.userId.toHexString(),
      { mode: ctx.mode, status, limit, before },
    );
    return Response.json({
      object: 'list',
      data: invoices.map(invoiceResponse),
    });
  } catch (err) {
    return fromRustError(err);
  }
}
