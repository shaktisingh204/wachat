/**
 * GET/POST /api/cron/sabchat-journeys
 *
 * SabChat outbound-journey tick. Runs one bounded sweep across ALL `kind:'chat'`
 * projects (there is no session/cookie in a cron context), advancing each due
 * run one step via the `sabchat-journeys` Rust engine's per-tenant `/tick`
 * endpoint. `message` steps land on `sabchat_journey_outbox`; a channel
 * dispatcher drains that separately (the engine exposes `/outbox` +
 * `/outbox/{id}/sent` for it).
 *
 * Flag-gated: the sweep only runs when `SABCHAT_JOURNEYS_ENABLED` is truthy, so
 * the feature ships dark until journeys are turned on for the deployment.
 *
 * Auth mirrors the other cron routes: `CRON_SECRET` accepted as
 * `Authorization: Bearer <secret>`, the `x-cron-secret` header, or `?secret=`.
 * When `CRON_SECRET` is unset the route is open (local/dev).
 *
 * To schedule in production register this route (every minute):
 *   - vercel.json     → `crons` entry `{ "path": "/api/cron/sabchat-journeys",
 *                        "schedule": "* * * * *" }`
 *   - scripts/cron-worker.mjs → add `{ name: 'sabchat-journeys',
 *                        path: '/api/cron/sabchat-journeys', schedule: '* * * * *' }`
 */

import { NextResponse, type NextRequest } from 'next/server';

import { connectToDatabase } from '@/lib/mongodb';
import { rustClient } from '@/lib/rust-client';
import { runWithRustTenantAs } from '@/lib/rust-client/fetcher';
import { deliverChatOutbox, deliverScheduledMessages } from '@/lib/sabchat/journey-dispatch';
import { getErrorMessage } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

function authorize(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true; // not configured → open (local/dev)
  const auth = req.headers.get('authorization') ?? '';
  if (auth === `Bearer ${expected}`) return true;
  const header = req.headers.get('x-cron-secret') ?? '';
  if (header === expected) return true;
  const query = new URL(req.url).searchParams.get('secret') ?? '';
  return query === expected;
}

function enabled(): boolean {
  const v = (process.env.SABCHAT_JOURNEYS_ENABLED ?? '').toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

async function handle(req: NextRequest): Promise<NextResponse> {
  if (!authorize(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!enabled()) {
    return NextResponse.json({ ok: true, skipped: 'disabled', projects: 0 });
  }

  try {
    const { db } = await connectToDatabase();
    const projects = await db
      .collection('projects')
      .find({ kind: 'chat' }, { projection: { _id: 1 } })
      .toArray();

    let advanced = 0;
    let messagesEnqueued = 0;
    let completed = 0;
    let delivered = 0;
    let scheduledSent = 0;
    let failed = 0;

    for (const p of projects) {
      const tid = String(p._id);
      try {
        // Per-tenant tick + chat delivery + send-later drain via the no-cookie
        // override (cron has no session). The tick enqueues message steps; the
        // drain delivers the chat channel in-app and marks rows sent; the
        // scheduled drain sends due send-later messages.
        const report = await runWithRustTenantAs(tid, tid, async () => {
          const tick = await rustClient.sabchatJourneys.tick({});
          const drain = await deliverChatOutbox();
          const scheduled = await deliverScheduledMessages();
          return { tick, drain, scheduled };
        });
        advanced += report.tick.advanced;
        messagesEnqueued += report.tick.messagesEnqueued;
        completed += report.tick.completed;
        delivered += report.drain.delivered;
        scheduledSent += report.scheduled.sent;
      } catch (err) {
        failed += 1;
        console.error(`[sabchat-journeys] tick failed for project ${tid}:`, getErrorMessage(err));
      }
    }

    return NextResponse.json({
      ok: true,
      projects: projects.length,
      advanced,
      messagesEnqueued,
      completed,
      delivered,
      scheduledSent,
      failed,
    });
  } catch (err) {
    console.error('[sabchat-journeys] tick error:', err);
    return NextResponse.json({ ok: false, error: getErrorMessage(err) }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
