import { NextRequest, NextResponse } from 'next/server';

import { deliverPendingWebhooks } from '@/lib/sabsign/webhooks';

/**
 * SabSign webhook delivery cron: flushes the `esign_webhook_deliveries` outbox
 * (HMAC-signed POSTs with exponential-backoff retry). Wire to a scheduler
 * (e.g. every minute). Gated by `CRON_SECRET` (Bearer header or `?secret=`).
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production';
  const header = req.headers.get('authorization');
  return header === `Bearer ${secret}` || req.nextUrl.searchParams.get('secret') === secret;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const result = await deliverPendingWebhooks();
    return NextResponse.json({ ok: true, ...result, at: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}

export const POST = GET;
