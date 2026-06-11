/**
 * GET /api/cron/sabflow-scheduled
 *
 * HTTP entry point for the SabFlow scheduled-trigger tick.
 *
 * The actual work lives in `@/lib/sabflow/triggers/cron-tick` — it scans
 * live `sabflows` docs for published flows with enabled `schedule` events,
 * matches their cron expressions against the current minute, and enqueues
 * one execution per (flow, event) onto the BullMQ queue the PM2
 * `sabflow-worker` consumes.
 *
 * On the self-hosted deployment the canonical driver is the PM2
 * `sabflow-scheduler` worker (`src/workers/sabflow-scheduler.ts`), which
 * calls the same tick every minute in-process. This route stays for
 * external cron services / manual ticks; both drivers are safe to run
 * concurrently because each (flow, event, minute) fire is claimed
 * atomically via a Mongo upsert (`fireKey`) plus a BullMQ jobId.
 *
 * Auth: `Authorization: Bearer ${CRON_SECRET}` (falls back to the
 * `vercel-cron: 1` header when no secret is configured).
 *
 * History: this route previously scanned the Track B `sabflow_workflows`
 * collection (which nothing writes) and enqueued onto the hand-rolled
 * `sabflow:cron` Redis queue (which nothing consumes) — scheduled flows
 * never fired. Both gaps closed 2026-06-11.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { connectToDatabase } from '@/lib/mongodb';
import { runScheduledTick } from '@/lib/sabflow/triggers/cron-tick';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

function isAuthorisedCronRequest(req: NextRequest): boolean {
    const auth = req.headers.get('authorization') ?? '';
    const secret = process.env.CRON_SECRET;
    if (!secret) {
        return req.headers.get('vercel-cron') === '1';
    }
    return auth === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
    if (!isAuthorisedCronRequest(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const startedAt = Date.now();
    try {
        const { db } = await connectToDatabase();
        const result = await runScheduledTick(db);
        return NextResponse.json({
            ok: true,
            tick: result.minute,
            scanned: result.scanned,
            matched: result.matched,
            fired: result.enqueued,
            alreadyClaimed: result.alreadyClaimed,
            deferred: result.deferred,
            errors: result.errors,
            durationMs: Date.now() - startedAt,
        });
    } catch (err) {
        console.error('[sabflow-scheduled] tick error:', err);
        return NextResponse.json(
            { ok: false, error: 'Internal server error' },
            { status: 500 },
        );
    }
}
