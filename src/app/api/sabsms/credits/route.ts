import { NextResponse, type NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';

import type {
  CreditFinaliseRequest,
  CreditReserveRequest,
  CreditReserveResponse,
} from '@/lib/sabsms/types';

/**
 * Credit reservation + finalisation callback.
 *
 * The Rust engine calls this BEFORE every provider attempt to reserve
 * credits, and AFTER the send completes to either finalise the charge
 * or release the reservation. The engine authenticates with the same
 * `SABSMS_ENGINE_TOKEN` that Next uses to reach the engine.
 *
 * Phase-0 implementation: always approve, return a fresh token. A
 * follow-up phase wires this to the workspace-credits ledger.
 */

function tokenOk(req: NextRequest): boolean {
  const expected = process.env.SABSMS_ENGINE_TOKEN ?? '';
  if (!expected) return false;
  return req.headers.get('x-sabsms-service-token') === expected;
}

export async function POST(req: NextRequest) {
  if (!tokenOk(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const op = url.searchParams.get('op'); // 'reserve' | 'finalise'

  if (op === 'reserve') {
    const body = (await req.json()) as CreditReserveRequest;
    if (!body?.workspaceId || !body?.messageId) {
      return NextResponse.json({ error: 'bad_request' }, { status: 400 });
    }
    const resp: CreditReserveResponse = {
      reservationToken: randomUUID(),
      approved: true,
    };
    return NextResponse.json(resp);
  }

  if (op === 'finalise') {
    const body = (await req.json()) as CreditFinaliseRequest;
    if (!body?.workspaceId || !body?.messageId || !body?.reservationToken) {
      return NextResponse.json({ error: 'bad_request' }, { status: 400 });
    }
    // Phase-0 stub — credit ledger wiring lands in a follow-up.
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'unknown_op' }, { status: 400 });
}
