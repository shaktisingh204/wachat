import { NextRequest } from 'next/server';

import {
  fromRustError,
  parseJsonBody,
  requireSabpayKey,
} from '@/lib/sabpay/api-route-helpers.server';
import { rustClient } from '@/lib/rust-client';
import type { SabpayOrder } from '@/lib/sabpay/types';

/**
 * SabPay public API — single order.
 *
 *   GET   /api/sabpay/v1/orders/:id   retrieve an order
 *   PATCH /api/sabpay/v1/orders/:id   update an order's notes
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function orderResponse(o: SabpayOrder) {
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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireSabpayKey(req);
  if ('error' in auth) return auth.error;
  const { ctx } = auth;

  const { id } = await params;

  try {
    const order = await rustClient.sabpay.getOrderAs(ctx.userId.toHexString(), id);
    return Response.json(orderResponse(order));
  } catch (err) {
    return fromRustError(err, 'Could not retrieve the order.');
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
    const order = await rustClient.sabpay.updateOrderAs(
      ctx.userId.toHexString(),
      id,
      {
        notes:
          body.notes && typeof body.notes === 'object'
            ? (body.notes as Record<string, unknown>)
            : undefined,
      },
    );
    return Response.json(orderResponse(order));
  } catch (err) {
    return fromRustError(err, 'Could not update the order.');
  }
}
