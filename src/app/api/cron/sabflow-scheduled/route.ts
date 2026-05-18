/**
 * GET /api/cron/sabflow-scheduled
 *
 * Vercel Cron dispatcher for SabFlow Track B `SabFlow.CronTrigger` nodes.
 *
 * Track B · Phase 6 · sub-task #2 of 10.
 *
 * Wakes every minute (see `vercel.ts` / `vercel.json` `crons[]`), scans
 * `sabflow_workflows` for active workflows whose root is a CronTrigger,
 * and — for every workflow whose cron expression(s) match the current
 * minute — enqueues a job onto `sabflow:cron` via {@link enqueueCronFire}.
 *
 * Native Vercel primitive — no node-cron / agenda / Bull (per project rule
 * "Deployment platform — Vercel (native, not integration)" in CLAUDE.md).
 *
 * Contract
 * --------
 * - Auth: `Authorization: Bearer ${CRON_SECRET}` (Vercel attaches it
 *   automatically on scheduled invocations).
 * - Reads: `sabflow_workflows` (forward-declared — schema sibling lands
 *   alongside the executor; we only project the fields we need so the
 *   handler is resilient to extra columns).
 * - Writes: enqueue side-effects only — no Mongo writes. The worker
 *   (Phase 2 sub-task #3) owns the execution lifecycle.
 *
 * Idempotency
 * -----------
 * Vercel Cron has at-least-once delivery. We pass
 * `idempotencyKey = ${workflowId}:${YYYY-MM-DDTHH:MM}` to the enqueue API
 * so two ticks for the same minute collapse onto a single job id (see
 * `enqueueCronFire` in `src/lib/sabflow/queue/enqueue.ts`).
 *
 * Concurrency
 * -----------
 * Caps fan-out at {@link MAX_ENQUEUES_PER_TICK} dispatches per tick so a
 * pathological "10k workflows fire on minute 0" backlog doesn't overwhelm
 * the queue. Anything beyond the cap is recorded as `deferred` and will
 * naturally retry on the next minute that matches.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { enqueueCronFire } from '@/lib/sabflow/queue/enqueue';
import {
    cronExpressionsForNode,
    type CronTriggerParameters,
} from '@/lib/sabflow/executor/nodes/cron-trigger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300; // Vercel Functions default cap.

/** Hard ceiling on enqueues per tick — keeps the queue + Mongo healthy. */
const MAX_ENQUEUES_PER_TICK = 50;
/** Mongo find() limit — only fetch as many candidates as we might dispatch. */
const MAX_CANDIDATES_PER_TICK = 1000;
/** Plan tier passed through to the queue when not declared on the workflow. */
const DEFAULT_PLAN_TIER = 'free';

// ─── Forward-declared Mongo shape ───────────────────────────────────────────
// The `sabflow_workflows` collection is owned by a sibling branch (Phase 2
// persistence). We project only the fields this dispatcher consumes; extra
// columns are ignored so the route is forward-compatible.

interface WorkflowNode {
    id: string;
    type: string;
    parameters?: Record<string, unknown>;
}

interface SabFlowWorkflowRow {
    _id: ObjectId;
    workspaceId: string;
    active?: boolean;
    plan?: string;
    nodes?: WorkflowNode[];
}

// ─── Auth ───────────────────────────────────────────────────────────────────

function isAuthorisedCronRequest(req: NextRequest): boolean {
    const auth = req.headers.get('authorization') ?? '';
    const secret = process.env.CRON_SECRET;
    if (!secret) {
        // No secret configured — fall back to Vercel's canonical signal.
        return req.headers.get('vercel-cron') === '1';
    }
    return auth === `Bearer ${secret}`;
}

// ─── Cron minute matching ───────────────────────────────────────────────────

/**
 * Truncate `date` to whole-minute UTC and format as `YYYY-MM-DDTHH:MM`.
 * Used both for the idempotency key and the `scheduledFor` ISO payload so
 * the same wall-clock minute can never disagree across both fields.
 */
function minuteBucket(date: Date): {
    iso: string;
    /** Compact form used inside the idempotency key. */
    stamp: string;
} {
    const d = new Date(date.getTime());
    d.setUTCSeconds(0, 0);
    const iso = d.toISOString(); // e.g. 2026-05-18T13:51:00.000Z
    // Strip the seconds+ms suffix — `YYYY-MM-DDTHH:MM`.
    const stamp = iso.slice(0, 16);
    return { iso, stamp };
}

/**
 * Minute-comparator built on top of `cronExpressionsForNode`.
 *
 * We don't import the parser/matcher from `cron-trigger.ts` (they're file-
 * private). Instead we re-implement a minimal matcher here for the same
 * 5-field grammar the trigger emits — `cronExpressionsForNode` is the
 * source of truth for which expressions exist, and this helper just asks
 * "does any of them match this minute?".
 */
function anyExpressionMatches(expressions: string[], date: Date): boolean {
    const minute = date.getUTCMinutes();
    const hour = date.getUTCHours();
    const dom = date.getUTCDate();
    const month = date.getUTCMonth() + 1; // cron is 1-based
    const dow = date.getUTCDay(); // 0=Sunday

    for (const expr of expressions) {
        if (minuteMatches(expr, { minute, hour, dom, month, dow })) {
            return true;
        }
    }
    return false;
}

interface CurrentMoment {
    minute: number;
    hour: number;
    dom: number;
    month: number;
    dow: number;
}

function minuteMatches(expr: string, now: CurrentMoment): boolean {
    const parts = expr.trim().split(/\s+/);
    if (parts.length !== 5) return false;
    const [m, h, d, mon, dow] = parts;

    if (!matchField(m, now.minute, 0, 59)) return false;
    if (!matchField(h, now.hour, 0, 23)) return false;
    if (!matchField(mon, now.month, 1, 12)) return false;

    // cron OR semantics: when both DOM and DOW are restricted, either match
    // is sufficient; when only one is restricted, that one governs.
    const domWildcard = d === '*';
    const dowWildcard = dow === '*';
    const domOk = matchField(d, now.dom, 1, 31);
    const dowOk = matchField(dow, now.dow, 0, 6);

    if (!domWildcard && !dowWildcard) return domOk || dowOk;
    return domOk && dowOk;
}

function matchField(field: string, value: number, min: number, max: number): boolean {
    if (field === '*') return true;
    for (const token of field.split(',')) {
        const stepIdx = token.indexOf('/');
        let rangePart = token;
        let step = 1;
        if (stepIdx !== -1) {
            rangePart = token.slice(0, stepIdx);
            const s = Number(token.slice(stepIdx + 1));
            if (!Number.isFinite(s) || s < 1 || !Number.isInteger(s)) continue;
            step = s;
        }
        let lo = min;
        let hi = max;
        if (rangePart !== '*') {
            const dashIdx = rangePart.indexOf('-');
            if (dashIdx !== -1) {
                lo = Number(rangePart.slice(0, dashIdx));
                hi = Number(rangePart.slice(dashIdx + 1));
            } else {
                lo = Number(rangePart);
                hi = stepIdx === -1 ? lo : max;
            }
            if (!Number.isFinite(lo) || !Number.isFinite(hi)) continue;
        }
        for (let v = lo; v <= hi; v += step) {
            if (v === value) return true;
        }
    }
    return false;
}

// ─── Workflow scanning ──────────────────────────────────────────────────────

async function findActiveCronWorkflows(): Promise<SabFlowWorkflowRow[]> {
    const { db } = await connectToDatabase();
    const col = db.collection<SabFlowWorkflowRow>('sabflow_workflows');
    return col
        .find(
            {
                active: true,
                'nodes.type': 'SabFlow.CronTrigger',
            },
            {
                projection: {
                    _id: 1,
                    workspaceId: 1,
                    active: 1,
                    plan: 1,
                    nodes: 1,
                },
            },
        )
        .limit(MAX_CANDIDATES_PER_TICK)
        .toArray();
}

/** Find the CronTrigger root node (first one wins). */
function findCronTriggerNode(flow: SabFlowWorkflowRow): WorkflowNode | undefined {
    return (flow.nodes ?? []).find((n) => n.type === 'SabFlow.CronTrigger');
}

// ─── Handler ────────────────────────────────────────────────────────────────

interface DispatchOutcome {
    workflowId: string;
    status: 'fired' | 'skipped' | 'deferred' | 'error';
    jobId?: string;
    reason?: string;
}

export async function GET(req: NextRequest) {
    if (!isAuthorisedCronRequest(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const { iso: scheduledFor, stamp } = minuteBucket(now);
    const startedAt = Date.now();

    const outcomes: DispatchOutcome[] = [];
    let enqueued = 0;

    try {
        const candidates = await findActiveCronWorkflows();

        for (const flow of candidates) {
            const workflowId = flow._id.toString();
            const trigger = findCronTriggerNode(flow);
            if (!trigger) {
                outcomes.push({ workflowId, status: 'skipped', reason: 'no trigger' });
                continue;
            }

            // Validate + extract cron expressions. A malformed node should
            // not poison the rest of the tick — record + continue.
            let expressions: string[];
            try {
                expressions = cronExpressionsForNode(
                    trigger.parameters as unknown as CronTriggerParameters,
                );
            } catch (err) {
                outcomes.push({
                    workflowId,
                    status: 'error',
                    reason: err instanceof Error ? err.message : String(err),
                });
                continue;
            }

            if (!anyExpressionMatches(expressions, now)) {
                continue; // not our minute — drop silently.
            }

            // Concurrency cap: stop *firing* once we've hit the ceiling, but
            // keep enumerating so the response surfaces what was deferred.
            if (enqueued >= MAX_ENQUEUES_PER_TICK) {
                outcomes.push({
                    workflowId,
                    status: 'deferred',
                    reason: `concurrency cap ${MAX_ENQUEUES_PER_TICK} reached`,
                });
                continue;
            }

            const fireKey = `${workflowId}:${stamp}`;
            try {
                const { jobId } = await enqueueCronFire({
                    workspaceId: flow.workspaceId,
                    workflowId,
                    scheduledFor,
                    idempotencyKey: fireKey,
                });
                enqueued += 1;
                outcomes.push({ workflowId, status: 'fired', jobId });
            } catch (err) {
                outcomes.push({
                    workflowId,
                    status: 'error',
                    reason: err instanceof Error ? err.message : String(err),
                });
            }
        }

        return NextResponse.json({
            ok: true,
            tick: scheduledFor,
            scanned: candidates.length,
            fired: enqueued,
            deferred: outcomes.filter((o) => o.status === 'deferred').length,
            errors: outcomes.filter((o) => o.status === 'error').length,
            durationMs: Date.now() - startedAt,
            results: outcomes,
        });
    } catch (err) {
        console.error('[sabflow-scheduled] tick error:', err);
        return NextResponse.json(
            {
                ok: false,
                tick: scheduledFor,
                error: err instanceof Error ? err.message : String(err),
                durationMs: Date.now() - startedAt,
            },
            { status: 500 },
        );
    }
}
