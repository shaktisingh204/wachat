import { NextRequest } from 'next/server';

import {
  fromRustError,
  parseJsonBody,
  requireSabpayKey,
} from '@/lib/sabpay/api-route-helpers.server';
import { rustClient } from '@/lib/rust-client';
import type { SabpayCustomer } from '@/lib/sabpay/types';

/**
 * SabPay public API — single customer.
 *
 *   GET    /api/sabpay/v1/customers/:id   retrieve a customer
 *   PATCH  /api/sabpay/v1/customers/:id   update a customer
 *   DELETE /api/sabpay/v1/customers/:id   delete a customer
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function customerResponse(c: SabpayCustomer) {
  return {
    id: c.id,
    object: 'customer',
    mode: c.mode,
    name: c.name,
    email: c.email,
    contact: c.contact,
    gstin: c.gstin,
    notes: c.notes ?? {},
    created_at: c.createdAt,
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
    const customer = await rustClient.sabpay.getCustomerAs(
      ctx.userId.toHexString(),
      id,
    );
    return Response.json(customerResponse(customer));
  } catch (err) {
    return fromRustError(err, 'Could not retrieve the customer.');
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
    const customer = await rustClient.sabpay.updateCustomerAs(
      ctx.userId.toHexString(),
      id,
      {
        name: typeof body.name === 'string' ? body.name : undefined,
        email: typeof body.email === 'string' ? body.email : undefined,
        contact: typeof body.contact === 'string' ? body.contact : undefined,
        gstin: typeof body.gstin === 'string' ? body.gstin : undefined,
        notes:
          body.notes && typeof body.notes === 'object'
            ? (body.notes as Record<string, unknown>)
            : undefined,
      },
    );
    return Response.json(customerResponse(customer));
  } catch (err) {
    return fromRustError(err, 'Could not update the customer.');
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
    await rustClient.sabpay.deleteCustomerAs(ctx.userId.toHexString(), id);
    return Response.json({ id, object: 'customer', deleted: true });
  } catch (err) {
    return fromRustError(err, 'Could not delete the customer.');
  }
}
