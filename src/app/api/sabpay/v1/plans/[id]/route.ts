import { NextRequest } from 'next/server';

import {
  requireSabpayKey,
  fromRustError,
} from '@/lib/sabpay/api-route-helpers.server';
import { rustClient } from '@/lib/rust-client';
import type { SabpayPlan } from '@/lib/sabpay/types';

/**
 * SabPay public API — single plan.
 *
 *   GET    /api/sabpay/v1/plans/:id   retrieve a plan
 *   DELETE /api/sabpay/v1/plans/:id   delete a plan
 *
 * Auth: `Authorization: Bearer sk_test_…` / `sk_live_…`.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function planResponse(p: SabpayPlan) {
  return {
    id: p.id,
    object: 'plan',
    mode: p.mode,
    name: p.name,
    amount: p.amount,
    currency: p.currency,
    interval: p.interval,
    interval_count: p.intervalCount,
    description: p.description,
    notes: p.notes ?? {},
    created_at: p.createdAt,
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
    const plan = await rustClient.sabpay.getPlanAs(ctx.userId.toHexString(), id);
    return Response.json(planResponse(plan));
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
    await rustClient.sabpay.deletePlanAs(ctx.userId.toHexString(), id);
    return Response.json({ id, object: 'plan', deleted: true });
  } catch (err) {
    return fromRustError(err);
  }
}
