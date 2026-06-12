import { NextResponse, type NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';

import type {
  CreditFinaliseRequest,
  CreditReserveRequest,
  CreditReserveResponse,
} from '@/lib/sabsms/types';
import {
  finaliseCredits,
  releaseExpiredHolds,
  reserveBatch,
  reserveCredits,
} from '@/lib/sabsms/credits/ledger';
import { creditCostFor } from '@/lib/sabsms/credits/rates';

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

    // The reserve body has no channel — 'sms' for now (derive later).
    const amount = creditCostFor({
      segments: body.segments,
      destinationCountry: body.destinationCountry ?? '',
      channel: 'sms',
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
    const body = (await req.json()) as CreditFinaliseRequest;
    if (!body?.workspaceId || !body?.messageId || !body?.reservationToken) {
      return NextResponse.json({ error: 'bad_request' }, { status: 400 });
    }

    if (body.workspaceId === '__admin_debug_dry_run__') {
      return NextResponse.json({ ok: true });
    }

    const result = await finaliseCredits({
      workspaceId: body.workspaceId,
      reservationToken: body.reservationToken,
      actualCost: body.actualCost,
      charge: body.charge,
    });
    return NextResponse.json(result);
  }

  if (op === 'reserve-batch') {
    const body = (await req.json()) as ReserveBatchBody;
    if (!body?.workspaceId || !body?.campaignId) {
      return NextResponse.json({ error: 'bad_request' }, { status: 400 });
    }

    const segmentsTotal = Math.max(1, Math.floor(Number(body.segmentsTotal) || 0));
    const amount = creditCostFor({
      segments: segmentsTotal,
      destinationCountry: body.destinationCountry ?? '',
      channel: 'sms',
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
