/**
 * SabPay subscription cycle runner (Vercel Cron `0 3 * * *`).
 *
 * Thin proxy: authorize with `CRON_SECRET`, then invoke the Rust cycle runner
 * (`POST /v1/sabpay/internal/cron/subscriptions`) which generates a cycle
 * invoice + payment for each due subscription. Test-mode cycles auto-succeed;
 * live-mode cycles emit `subscription.pending` with a payable link. Three
 * consecutive unpaid cycles → `halted`. `?execute=1` performs writes.
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
      `/v1/sabpay/internal/cron/subscriptions?execute=${execute ? '1' : '0'}`,
      { method: 'POST', headers: { 'x-cron-secret': process.env.CRON_SECRET as string } },
    );
    return NextResponse.json({ ok: true, dryRun: !execute, result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'subscription run failed' },
      { status: 500 },
    );
  }
}

export const GET = handle;
export const POST = handle;
