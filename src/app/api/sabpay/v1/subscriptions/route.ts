import { NextRequest } from 'next/server';

import {
  requireSabpayKey,
  parseJsonBody,
  fromRustError,
  listQuery,
  withIdempotency,
} from '@/lib/sabpay/api-route-helpers.server';
import { rustClient } from '@/lib/rust-client';
import type { SabpaySubscription } from '@/lib/sabpay/types';

/**
 * SabPay public API — subscriptions.
 *
 *   POST /api/sabpay/v1/subscriptions   create a recurring-billing subscription
 *   GET  /api/sabpay/v1/subscriptions   list subscriptions (newest first)
 *
 * Auth: `Authorization: Bearer sk_test_…` / `sk_live_…`. The data operation
 * is performed by the Rust engine acting as the merchant's user id.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function subscriptionResponse(s: SabpaySubscription) {
  return {
    id: s.id,
    object: 'subscription',
    mode: s.mode,
    status: s.status,
    plan_id: s.planId,
    customer_id: s.customerId,
    total_count: s.totalCount,
    paid_count: s.paidCount,
    missed_cycles: s.missedCycles,
    next_charge_at: s.nextChargeAt,
    cancel_at_cycle_end: s.cancelAtCycleEnd ?? false,
    notes: s.notes ?? {},
    created_at: s.createdAt,
    paused_at: s.pausedAt,
    cancelled_at: s.cancelledAt,
    ended_at: s.endedAt,
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
    const subscription = await rustClient.sabpay.createSubscriptionAs(
      ctx.userId.toHexString(),
      {
        planId: body.plan_id as string,
        customerId:
          typeof body.customer_id === 'string' ? body.customer_id : undefined,
        totalCount: body.total_count as number,
        startAt: typeof body.start_at === 'string' ? body.start_at : undefined,
        notes:
          body.notes && typeof body.notes === 'object'
            ? (body.notes as Record<string, unknown>)
            : undefined,
        mode: ctx.mode,
      },
    );
    return { status: 201, body: subscriptionResponse(subscription) };
  });
}

export async function GET(req: NextRequest) {
  const auth = await requireSabpayKey(req);
  if ('error' in auth) return auth.error;
  const { ctx } = auth;

  const { limit, before, status } = listQuery(req);

  try {
    const { subscriptions } = await rustClient.sabpay.listSubscriptionsAs(
      ctx.userId.toHexString(),
      { mode: ctx.mode, status, limit, before },
    );
    return Response.json({
      object: 'list',
      data: subscriptions.map(subscriptionResponse),
    });
  } catch (err) {
    return fromRustError(err);
  }
}
