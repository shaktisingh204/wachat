import { NextResponse, type NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';

import type {
  CreditReserveRequest,
  CreditReserveResponse,
} from '@/lib/sabsms/types';
import {
  finaliseCredits,
  releaseExpiredHolds,
  reserveBatch,
  reserveCredits,
} from '@/lib/sabsms/credits/ledger';
import {
  normalizeChannel,
  type SabsmsCreditFinaliseBody,
} from '@/lib/sabsms/credits/types';
import { creditCostForWorkspace } from '@/lib/sabsms/ratecards/store';

/**
 * Credit reservation + finalisation callback.
 *
 * The Rust engine calls this BEFORE every provider attempt to reserve
 * credits, and AFTER the send completes to either finalise the charge
 * or release the reservation. The engine authenticates with the same
 * `SABSMS_ENGINE_TOKEN` that Next uses to reach the engine.
 *
 * Phase V2.0: wired to the real ledger — atomic holds against
 * `users.credits.sms`, append-only rows in `sabsms_credit_ledger`.
 */

function tokenOk(req: NextRequest): boolean {
  const expected = process.env.SABSMS_ENGINE_TOKEN ?? '';
  if (!expected) return false;
  return req.headers.get('x-sabsms-service-token') === expected;
}

interface ReserveBatchBody {
  workspaceId: string;
  campaignId: string;
  count: number;
  segmentsTotal: number;
  estimatedCost?: number;
  category?: CreditReserveRequest['category'];
  destinationCountry?: string;
  /** Channel for the whole-batch hold; defaults to 'sms'. */
  channel?: string;
}

export async function POST(req: NextRequest) {
  if (!tokenOk(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Lazy sweep of expired holds — fire-and-forget, never blocks the response.
  void releaseExpiredHolds().catch(() => {});

  const url = new URL(req.url);
  const op = url.searchParams.get('op'); // 'reserve' | 'finalise' | 'reserve-batch'

  try {
    return await handleOp(op, req);
  } catch (err) {
    console.error('[sabsms/credits] op failed', { op }, err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

async function handleOp(op: string | null, req: NextRequest): Promise<NextResponse> {
  if (op === 'reserve') {
    const body = (await req.json()) as CreditReserveRequest;
    if (!body?.workspaceId || !body?.messageId) {
      return NextResponse.json({ error: 'bad_request' }, { status: 400 });
    }

    if (body.workspaceId === '__admin_debug_dry_run__') {
      return NextResponse.json({
        reservationToken: randomUUID(),
        approved: false,
        reason: 'dry_run_testing_engine_ingestion',
      });
    }

    // V2.13: per-workspace reseller rate cards resolve first, falling
    // back to the platform default table (`creditCostFor`). The engine
    // sends the message's real channel (sms/mms/rcs), so MMS holds at the
    // 3× multiplier and RCS at the flat per-message rate — never billed
    // as plain per-segment SMS.
    const amount = await creditCostForWorkspace(body.workspaceId, {
      segments: body.segments,
      destinationCountry: body.destinationCountry ?? '',
      channel: normalizeChannel(body.channel),
      category: body.category,
    });

    const result = await reserveCredits({
      workspaceId: body.workspaceId,
      messageId: body.messageId,
      amount,
    });

    const resp: CreditReserveResponse = result.approved
      ? { reservationToken: result.reservationToken!, approved: true }
      : { reservationToken: randomUUID(), approved: false, reason: result.reason };
    return NextResponse.json(resp);
  }

  if (op === 'finalise') {
    // `actualCost` is the engine's LEGACY field name for the provider
    // wholesale cost in cents; accepted here until the engine ships the
    // `providerCostCents` rename. Never treated as credits.
    const body = (await req.json()) as SabsmsCreditFinaliseBody & { actualCost?: number };
    if (!body?.workspaceId || !body?.messageId || !body?.reservationToken) {
      return NextResponse.json({ error: 'bad_request' }, { status: 400 });
    }

    if (body.workspaceId === '__admin_debug_dry_run__') {
      return NextResponse.json({ ok: true });
    }

    // Reprice the TRUE credit charge from the provider's REAL billed
    // segment count + channel (MMS 3×, RCS flat) — NEVER from provider
    // cents. When the engine omits `actualSegments` (legacy finalise),
    // the channel-priced hold stands and no true-up is applied.
    let chargeCredits: number | undefined;
    if (
      body.charge &&
      typeof body.actualSegments === 'number' &&
      Number.isFinite(body.actualSegments) &&
      body.actualSegments > 0
    ) {
      chargeCredits = await creditCostForWorkspace(body.workspaceId, {
        segments: body.actualSegments,
        destinationCountry: body.destinationCountry ?? '',
        channel: normalizeChannel(body.channel),
      });
    }

    // Provider wholesale cost (cents) is analytics metadata ONLY — it is
    // recorded on the debit ledger row and never moves the credit balance.
    const providerCostCents =
      typeof body.providerCostCents === 'number'
        ? body.providerCostCents
        : typeof body.actualCost === 'number'
          ? body.actualCost
          : undefined;

    const result = await finaliseCredits({
      workspaceId: body.workspaceId,
      reservationToken: body.reservationToken,
      charge: body.charge,
      chargeCredits,
      providerCostCents,
    });
    return NextResponse.json(result);
  }

  if (op === 'reserve-batch') {
    const body = (await req.json()) as ReserveBatchBody;
    if (!body?.workspaceId || !body?.campaignId) {
      return NextResponse.json({ error: 'bad_request' }, { status: 400 });
    }

    const segmentsTotal = Math.max(1, Math.floor(Number(body.segmentsTotal) || 0));
    // V2.13: same rate-card-aware, channel-aware pricing for whole-campaign holds.
    const amount = await creditCostForWorkspace(body.workspaceId, {
      segments: segmentsTotal,
      destinationCountry: body.destinationCountry ?? '',
      channel: normalizeChannel(body.channel),
      category: body.category,
    });

    const result = await reserveBatch({
      workspaceId: body.workspaceId,
      campaignId: body.campaignId,
      count: Math.max(0, Math.floor(Number(body.count) || 0)),
      segmentsTotal,
      amount,
    });

    const resp: CreditReserveResponse = result.approved
      ? { reservationToken: result.reservationToken!, approved: true }
      : { reservationToken: randomUUID(), approved: false, reason: result.reason };
    return NextResponse.json(resp);
  }

  return NextResponse.json({ error: 'unknown_op' }, { status: 400 });
}
