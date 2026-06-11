/**
 * SabPay daily settlement runner (Vercel Cron `30 1 * * *`).
 *
 * Thin proxy: authorize the cron caller with `CRON_SECRET`, then invoke the
 * Rust settlement runner (`POST /v1/sabpay/internal/cron/settlements`) which
 * does the T+2 ledger work (group succeeded live payments minus fees/tax,
 * process pending refunds, deduct lost disputes, emit `settlement.processed`).
 * `?execute=1` performs writes; default is a dry run.
 *
 * Auth: `Authorization: Bearer $CRON_SECRET` (or `x-cron-secret` fallback).
 */
import { NextResponse, type NextRequest } from 'next/server';

import { rustFetchPublic } from '@/lib/rust-client/fetcher';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function authorize(req: NextRequest): { ok: true } | { ok: false; status: number } {
  const expected = process.env.CRON_SECRET;
  if (!expected) return { ok: false, status: 503 };
  const auth = req.headers.get('authorization') ?? '';
  if (auth === `Bearer ${expected}`) return { ok: true };
  if ((req.headers.get('x-cron-secret') ?? '') === expected) return { ok: true };
  return { ok: false, status: 401 };
}

async function handle(req: NextRequest): Promise<NextResponse> {
  const guard = authorize(req);
  if (!guard.ok) {
    return NextResponse.json(
      { error: guard.status === 503 ? 'CRON_SECRET not configured' : 'Unauthorized' },
      { status: guard.status },
    );
  }
  const execute = new URL(req.url).searchParams.get('execute') === '1';
  try {
    const result = await rustFetchPublic(
      `/v1/sabpay/internal/cron/settlements?execute=${execute ? '1' : '0'}`,
      { method: 'POST', headers: { 'x-cron-secret': process.env.CRON_SECRET as string } },
    );
    return NextResponse.json({ ok: true, dryRun: !execute, result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'settlement run failed' },
      { status: 500 },
    );
  }
}

export const GET = handle;
export const POST = handle;
