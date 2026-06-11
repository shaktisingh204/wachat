import { NextRequest } from 'next/server';

import {
  requireSabpayKey,
  parseJsonBody,
  fromRustError,
  listQuery,
  withIdempotency,
} from '@/lib/sabpay/api-route-helpers.server';
import { rustClient } from '@/lib/rust-client';
import type { SabpayPlan } from '@/lib/sabpay/types';

/**
 * SabPay public API — plans.
 *
 *   POST /api/sabpay/v1/plans   create a subscription-plan template
 *   GET  /api/sabpay/v1/plans   list plans (newest first)
 *
 * Auth: `Authorization: Bearer sk_test_…` / `sk_live_…`. The key prefix
 * decides the mode, so test keys can never create live objects. The data
 * operation is performed by the Rust engine acting as the merchant's user id.
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

export async function POST(req: NextRequest) {
  const auth = await requireSabpayKey(req);
  if ('error' in auth) return auth.error;
  const { ctx } = auth;

  const parsed = await parseJsonBody(req);
  if ('error' in parsed) return parsed.error;
  const { body } = parsed;

  return withIdempotency(req, ctx, body, async () => {
    const plan = await rustClient.sabpay.createPlanAs(
      ctx.userId.toHexString(),
      {
        name: body.name as string,
        amount: body.amount as number,
        currency: typeof body.currency === 'string' ? body.currency : undefined,
        interval: body.interval as string,
        intervalCount:
          typeof body.interval_count === 'number' ? body.interval_count : undefined,
        description:
          typeof body.description === 'string' ? body.description : undefined,
        notes:
          body.notes && typeof body.notes === 'object'
            ? (body.notes as Record<string, unknown>)
            : undefined,
        mode: ctx.mode,
      },
    );
    return { status: 201, body: planResponse(plan) };
  });
}

export async function GET(req: NextRequest) {
  const auth = await requireSabpayKey(req);
  if ('error' in auth) return auth.error;
  const { ctx } = auth;

  const { limit, before } = listQuery(req);

  try {
    const { plans } = await rustClient.sabpay.listPlansAs(
      ctx.userId.toHexString(),
      { mode: ctx.mode, limit, before },
    );
    return Response.json({
      object: 'list',
      data: plans.map(planResponse),
    });
  } catch (err) {
    return fromRustError(err);
  }
}
