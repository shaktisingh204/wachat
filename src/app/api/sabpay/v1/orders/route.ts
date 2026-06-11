import { NextRequest } from 'next/server';

import {
  fromRustError,
  listQuery,
  parseJsonBody,
  requireSabpayKey,
  withIdempotency,
} from '@/lib/sabpay/api-route-helpers.server';
import { rustClient } from '@/lib/rust-client';
import type { SabpayOrder } from '@/lib/sabpay/types';

/**
 * SabPay public API — orders.
 *
 *   POST /api/sabpay/v1/orders   create an order
 *   GET  /api/sabpay/v1/orders   list orders (newest first)
 *
 * Auth: `Authorization: Bearer sk_test_…` / `sk_live_…`. The key prefix
 * decides the mode; the data op runs in Rust acting as the merchant's user id.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export function orderResponse(o: SabpayOrder) {
  return {
    id: o.id,
    object: 'order',
    mode: o.mode,
    amount: o.amount,
    amount_paid: o.amountPaid,
    amount_due: o.amountDue,
    currency: o.currency,
    status: o.status,
    receipt: o.receipt,
    notes: o.notes ?? {},
    created_at: o.createdAt,
    paid_at: o.paidAt,
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
    const order = await rustClient.sabpay.createOrderAs(
      ctx.userId.toHexString(),
      {
        amount: body.amount as number,
        currency: typeof body.currency === 'string' ? body.currency : undefined,
        receipt: typeof body.receipt === 'string' ? body.receipt : undefined,
        notes:
          body.notes && typeof body.notes === 'object'
            ? (body.notes as Record<string, unknown>)
            : undefined,
        mode: ctx.mode,
      },
    );
    return { status: 201, body: orderResponse(order) };
  }, 'Could not create the order.');
}

export async function GET(req: NextRequest) {
  const auth = await requireSabpayKey(req);
  if ('error' in auth) return auth.error;
  const { ctx } = auth;

  const { limit, before, status } = listQuery(req);

  try {
    const { orders } = await rustClient.sabpay.listOrdersAs(
      ctx.userId.toHexString(),
      { mode: ctx.mode, status, limit, before },
    );
    return Response.json({ object: 'list', data: orders.map(orderResponse) });
  } catch (err) {
    return fromRustError(err, 'Could not list orders.');
  }
}
