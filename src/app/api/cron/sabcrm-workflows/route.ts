/**
 * SabCRM workflow SCHEDULER cron.
 *
 * Fires due CRON/schedule-triggered SabCRM workflows and retries the most
 * recent failed runs. Runs server-side with a system service token (no user
 * session) — see `src/lib/sabcrm/scheduler.ts` and
 * `src/lib/rust-client/service-fetch.ts`.
 *
 * Scheduled by Vercel Cron every 5 minutes (see `vercel.json`).
 *
 * Auth: `Authorization: Bearer $CRON_SECRET` (Vercel cron's default,
 * mirroring `/api/cron/audit-retention`). `x-cron-secret: $secret` is accepted
 * as a fallback for non-Vercel schedulers.
 *
 * Response: the `{ ran, failed, summary, ... }` report from `runDueWorkflows()`.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { runDueWorkflows } from '@/lib/sabcrm/scheduler';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function authorize(
    request: NextRequest,
): { ok: true } | { ok: false; status: number; body: unknown } {
    const expected = process.env.CRON_SECRET;
    if (!expected) {
        return {
            ok: false,
            status: 503,
            body: { error: 'CRON_SECRET not configured' },
        };
    }
    const auth = request.headers.get('authorization') ?? '';
    if (auth === `Bearer ${expected}`) return { ok: true };
    const xCron = request.headers.get('x-cron-secret') ?? '';
    if (xCron === expected) return { ok: true };
    return { ok: false, status: 401, body: { error: 'Unauthorized' } };
}

async function handle(request: NextRequest): Promise<NextResponse> {
    const guard = authorize(request);
    if (!guard.ok) {
        return NextResponse.json(guard.body, { status: guard.status });
    }

    try {
        const report = await runDueWorkflows();
        return NextResponse.json({ ok: true, ...report });
    } catch (e) {
        // runDueWorkflows is best-effort and shouldn't throw, but guard anyway
        // so the cron endpoint always returns a clean JSON envelope.
        const message = e instanceof Error ? e.message : String(e);
        console.error('[sabcrm-workflows cron] fatal:', e);
        return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    return handle(request);
}

export async function POST(request: NextRequest) {
    return handle(request);
}
