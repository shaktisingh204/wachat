import { NextRequest } from 'next/server';

import {
  requireSabpayKey,
  parseJsonBody,
  fromRustError,
} from '@/lib/sabpay/api-route-helpers.server';
import { rustClient } from '@/lib/rust-client';
import type {
  SabpayInvoice,
  SabpayLineItem,
} from '@/lib/sabpay/types';
import type { SabpayInvoiceLineItemInput } from '@/lib/rust-client/sabpay';

/**
 * SabPay public API — single invoice.
 *
 *   GET    /api/sabpay/v1/invoices/:id   retrieve an invoice
 *   PATCH  /api/sabpay/v1/invoices/:id   update a draft invoice
 *   DELETE /api/sabpay/v1/invoices/:id   delete a draft invoice
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

function parseLineItems(value: unknown): SabpayInvoiceLineItemInput[] | undefined {
  if (!Array.isArray(value)) return undefined;
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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireSabpayKey(req);
  if ('error' in auth) return auth.error;
  const { ctx } = auth;

  const { id } = await params;

  try {
    const invoice = await rustClient.sabpay.getInvoiceAs(
      ctx.userId.toHexString(),
      id,
    );
    return Response.json(invoiceResponse(invoice));
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
    const invoice = await rustClient.sabpay.updateInvoiceAs(
      ctx.userId.toHexString(),
      id,
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
        notes:
          body.notes && typeof body.notes === 'object'
            ? (body.notes as Record<string, unknown>)
            : undefined,
        expireBy: typeof body.expire_by === 'string' ? body.expire_by : undefined,
      },
    );
    return Response.json(invoiceResponse(invoice));
  } catch (err) {
    return fromRustError(err);
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
    await rustClient.sabpay.deleteInvoiceAs(ctx.userId.toHexString(), id);
    return Response.json({ id, object: 'invoice', deleted: true });
  } catch (err) {
    return fromRustError(err);
  }
}
