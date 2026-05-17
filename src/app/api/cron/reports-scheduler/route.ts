/**
 * CRM Reports scheduler — `CRM_REBUILD_PLAN.md` §6.8.
 *
 * Runs hourly on Vercel Cron. Scans `crm_report_definitions` for any
 * doc with an active schedule whose cron expression matches the
 * current UTC hour, then enqueues a run for each one via the engine.
 *
 * Defaults to **dry-run** so this can be deployed safely; pass
 * `?execute=1` to actually fire the engine. Capped at 50 runs per
 * tick to avoid bombarding downstream email / webhook recipients.
 *
 * Auth: `Authorization: Bearer $CRON_SECRET` (Vercel's default) OR
 * `x-cron-secret: $CRON_SECRET` for manual curls.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { connectToDatabase } from '@/lib/mongodb';
import {
    executeReportDefinition,
    type ReportDefinitionDoc,
} from '@/app/actions/crm-reports.actions';
import { cronMatchesHour } from '@/lib/crm/cron-match';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const MAX_RUNS_PER_TICK = 50;

function authorize(
    request: NextRequest,
): { ok: true } | { ok: false; status: number; body: unknown } {
    const expected = process.env.CRON_SECRET;
    if (!expected) {
        return { ok: false, status: 503, body: { error: 'CRON_SECRET not configured' } };
    }
    const auth = request.headers.get('authorization') ?? '';
    if (auth === `Bearer ${expected}`) return { ok: true };
    const xCron = request.headers.get('x-cron-secret') ?? '';
    if (xCron === expected) return { ok: true };
    return { ok: false, status: 401, body: { error: 'Unauthorized' } };
}

async function handle(request: NextRequest): Promise<NextResponse> {
    const guard = authorize(request);
    if (!guard.ok) return NextResponse.json(guard.body, { status: guard.status });

    const execute = request.nextUrl.searchParams.get('execute') === '1';
    const now = new Date();
    const startedAt = Date.now();

    let scanned = 0;
    let matched = 0;
    let executed = 0;
    let failed = 0;
    const errors: string[] = [];
    const dispatched: Array<{
        definitionId: string;
        userId: string;
        kind: string;
        runId?: string;
        ok: boolean;
        error?: string;
    }> = [];

    try {
        const { db } = await connectToDatabase();

        // Only consider definitions with an active cron schedule.
        const cursor = db.collection('crm_report_definitions').find(
            {
                'schedule.active': true,
                'schedule.cron': { $exists: true, $ne: null },
            } as any,
        );

        for await (const raw of cursor) {
            scanned++;
            const doc = raw as any as ReportDefinitionDoc & { _id: any; userId: any };
            const cron = doc.schedule?.cron;
            if (!cron) continue;

            // The cron field is matched against the current UTC hour.
            // Per-minute precision is intentionally ignored — Vercel
            // cron ticks hourly, so finer cron resolution is moot
            // until the platform supports it.
            if (!cronMatchesHour(cron, now)) continue;
            matched++;

            if (matched > MAX_RUNS_PER_TICK) {
                errors.push(
                    `cap_reached: skipped ${doc._id} (and any further) at ${MAX_RUNS_PER_TICK} matched runs`,
                );
                break;
            }

            const entry: {
                definitionId: string;
                userId: string;
                kind: string;
                runId?: string;
                ok: boolean;
                error?: string;
            } = {
                definitionId: String(doc._id),
                userId: String(doc.userId),
                kind: doc.kind,
                ok: false,
            };

            if (!execute) {
                entry.ok = true;
                entry.error = 'dry_run';
                dispatched.push(entry);
                continue;
            }

            try {
                const exec = await executeReportDefinition({
                    definition: {
                        ...doc,
                        _id: String(doc._id),
                        userId: String(doc.userId),
                    } as ReportDefinitionDoc,
                    tenantUserId: String(doc.userId),
                    trigger: 'cron',
                });
                entry.ok = true;
                entry.runId = exec.runId;
                executed++;
            } catch (e: any) {
                failed++;
                entry.error = e?.message ?? 'execute_failed';
                errors.push(`def ${doc._id}: ${entry.error}`);
            }
            dispatched.push(entry);
        }

        return NextResponse.json({
            ok: true,
            execute,
            now: now.toISOString(),
            scanned,
            matched,
            executed,
            failed,
            cap: MAX_RUNS_PER_TICK,
            dispatched,
            durationMs: Date.now() - startedAt,
            errors,
        });
    } catch (e: any) {
        console.error('[reports-scheduler] fatal:', e);
        return NextResponse.json(
            {
                ok: false,
                error: e?.message ?? 'Internal error',
                scanned,
                matched,
                executed,
                failed,
            },
            { status: 500 },
        );
    }
}

export async function GET(request: NextRequest) {
    return handle(request);
}

export async function POST(request: NextRequest) {
    return handle(request);
}
