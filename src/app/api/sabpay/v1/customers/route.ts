import { NextRequest } from 'next/server';

import {
  fromRustError,
  parseJsonBody,
  requireSabpayKey,
  withIdempotency,
} from '@/lib/sabpay/api-route-helpers.server';
import { rustClient } from '@/lib/rust-client';
import type { SabpayCustomer } from '@/lib/sabpay/types';

/**
 * SabPay public API — customers.
 *
 *   POST /api/sabpay/v1/customers   create a customer
 *   GET  /api/sabpay/v1/customers   list customers (newest first; ?search=)
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export function customerResponse(c: SabpayCustomer) {
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

export async function POST(req: NextRequest) {
  const auth = await requireSabpayKey(req);
  if ('error' in auth) return auth.error;
  const { ctx } = auth;

  const parsed = await parseJsonBody(req);
  if ('error' in parsed) return parsed.error;
  const { body } = parsed;

  return withIdempotency(req, ctx, body, async () => {
    const customer = await rustClient.sabpay.createCustomerAs(
      ctx.userId.toHexString(),
      {
        name: body.name as string,
        email: typeof body.email === 'string' ? body.email : undefined,
        contact: typeof body.contact === 'string' ? body.contact : undefined,
        gstin: typeof body.gstin === 'string' ? body.gstin : undefined,
        notes:
          body.notes && typeof body.notes === 'object'
            ? (body.notes as Record<string, unknown>)
            : undefined,
        mode: ctx.mode,
      },
    );
    return { status: 201, body: customerResponse(customer) };
  }, 'Could not create the customer.');
}

export async function GET(req: NextRequest) {
  const auth = await requireSabpayKey(req);
  if ('error' in auth) return auth.error;
  const { ctx } = auth;

  const url = new URL(req.url);
  const search = url.searchParams.get('search') ?? undefined;
  const limit = Number.parseInt(url.searchParams.get('limit') ?? '25', 10) || 25;
  const before = url.searchParams.get('before') ?? undefined;

  try {
    const { customers } = await rustClient.sabpay.listCustomersAs(
      ctx.userId.toHexString(),
      { mode: ctx.mode, search, limit, before },
    );
    return Response.json({
      object: 'list',
      data: customers.map(customerResponse),
    });
  } catch (err) {
    return fromRustError(err, 'Could not list customers.');
  }
}
