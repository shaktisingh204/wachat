import { NextRequest } from 'next/server';

import {
  requireSabpayKey,
  fromRustError,
} from '@/lib/sabpay/api-route-helpers.server';
import { rustClient } from '@/lib/rust-client';
import type { SabpaySubscription } from '@/lib/sabpay/types';

/**
 * SabPay public API — pause a subscription.
 *
 *   POST /api/sabpay/v1/subscriptions/:id/pause
 *
 * Auth: `Authorization: Bearer sk_test_…` / `sk_live_…`.
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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireSabpayKey(req);
  if ('error' in auth) return auth.error;
  const { ctx } = auth;

  const { id } = await params;

  try {
    const subscription = await rustClient.sabpay.pauseSubscriptionAs(
      ctx.userId.toHexString(),
      id,
    );
    return Response.json(subscriptionResponse(subscription));
  } catch (err) {
    return fromRustError(err);
  }
}
