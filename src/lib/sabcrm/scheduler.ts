import 'server-only';

/**
 * SabCRM workflow SCHEDULER — fires CRON/schedule-triggered workflows and
 * retries recently-failed runs, driven by a Vercel cron
 * (`/api/cron/sabcrm-workflows`, every 5 min).
 *
 * Unlike `runtime.ts` (which fires record-lifecycle workflows *inline* in a
 * user's request, reading identity from the session cookie), the scheduler
 * runs with **no user session**. Every engine call therefore goes through
 * {@link rustServiceFetch} with a system service token scoped to each
 * workflow's own `projectId`.
 *
 * ## What it does, per invocation
 *
 * 1. **Due CRON workflows.** Read `sabcrm_workflows` straight from Mongo
 *    (`connectToDatabase`), keep the `enabled` ones whose trigger is a
 *    schedule/cron trigger, and run the ones whose schedule is currently due.
 *    Each due workflow's steps are executed against the engine and a run is
 *    recorded in `sabcrm_workflow_runs`.
 * 2. **Retry failed runs.** Best-effort: pick the most recent `failed` runs
 *    from `sabcrm_workflow_runs`, re-execute their parent workflow's steps, and
 *    record a fresh run.
 *
 * Everything is best-effort and wrapped in try/catch — a downed engine or an
 * unset `RUST_API_URL` must NOT throw out of the cron; it surfaces in the
 * returned `{ ran, failed, summary }` report instead. Work is capped per
 * invocation so a backlog can't blow the 300 s function budget.
 *
 * ## Due-check logic (kept deliberately simple + documented)
 *
 * A workflow is considered a scheduled workflow when `trigger.event` is one of
 * the schedule events (`schedule` / `cron` / `record.scheduled`), OR it carries
 * a schedule hint in `trigger.config` (`schedule` / `cron` / `intervalMinutes`).
 *
 * Due-ness is decided from `lastRunAt` + an interval, NOT by parsing a full
 * 5-field cron expression (no cron-parser dep is available, and adding one is
 * out of scope):
 *
 *   - If the workflow has never run (`lastRunAt` absent) → it is due now.
 *   - Otherwise it is due when `now - lastRunAt >= intervalMs`, where
 *     `intervalMs` comes from `trigger.config.intervalMinutes` (preferred), or
 *     is *derived* from a recognised cron string (`* * * * *` → 1 min,
 *     `*​/N * * * *` → N min, `0 * * * *` → 60 min, `0 0 * * *` → 1 day),
 *     falling back to a 60-minute default for anything we can't parse.
 *
 * This means the cron cadence (5 min) is the floor on resolution: a workflow
 * asking for "every minute" effectively runs at most every 5 minutes. That is
 * an accepted, documented limitation — the scheduler is an interval runner, not
 * a precise cron engine.
 */

import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { rustServiceFetch } from '@/lib/rust-client/service-fetch';

// ---------------------------------------------------------------------------
// Caps — keep one invocation well inside the 300s function budget.
// ---------------------------------------------------------------------------

/** Max scheduled workflows fired per invocation. */
const MAX_WORKFLOWS_PER_RUN = 25;
/** Max failed runs retried per invocation. */
const MAX_RETRIES_PER_RUN = 10;
/** Default interval (minutes) when a schedule can't be parsed. */
const DEFAULT_INTERVAL_MINUTES = 60;

const WORKFLOWS_COLL = 'sabcrm_workflows';
const RUNS_COLL = 'sabcrm_workflow_runs';

// ---------------------------------------------------------------------------
// Report shape
// ---------------------------------------------------------------------------

/** Per-workflow / per-retry outcome line in the report. */
export interface SchedulerItemReport {
    workflowId: string;
    projectId: string;
    /** `ran` | `skipped` | `failed`. */
    status: 'ran' | 'skipped' | 'failed';
    /** Why it was skipped, or the failure message. */
    detail?: string;
    /** Steps that executed successfully (when it ran). */
    stepsRun?: number;
    /** Steps that failed (swallowed; recorded on the run). */
    stepsFailed?: number;
}

/** The report returned by {@link runDueWorkflows}. */
export interface SchedulerReport {
    /** Total workflows + retries that executed (any step attempted). */
    ran: number;
    /** Total items that failed to execute (engine error, etc.). */
    failed: number;
    /** Human-readable summary of what happened this invocation. */
    summary: string;
    /** Whether the engine appears reachable (false → calls failed). */
    engineReachable: boolean;
    /** Scheduled-workflow outcomes. */
    scheduled: SchedulerItemReport[];
    /** Failed-run retry outcomes. */
    retried: SchedulerItemReport[];
    /** Milliseconds spent. */
    durationMs: number;
}

// ---------------------------------------------------------------------------
// Loose document shapes (Mongo is read directly; tolerate missing fields).
// ---------------------------------------------------------------------------

interface WorkflowStepDoc {
    id?: string;
    type?: string;
    config?: Record<string, unknown>;
}

interface WorkflowDoc {
    _id: ObjectId | string;
    projectId?: string;
    name?: string;
    enabled?: boolean;
    trigger?: {
        event?: string;
        object?: string;
        config?: Record<string, unknown>;
        [k: string]: unknown;
    };
    steps?: WorkflowStepDoc[];
    lastRunAt?: string | Date;
}

interface RunDoc {
    _id: ObjectId | string;
    projectId?: string;
    workflowId?: string;
    status?: string;
    trigger?: unknown;
    createdAt?: string | Date;
    startedAt?: string | Date;
}

// ---------------------------------------------------------------------------
// Due-check
// ---------------------------------------------------------------------------

const SCHEDULE_EVENTS = new Set(['schedule', 'cron', 'scheduled', 'record.scheduled']);

/** Is this workflow a scheduled (CRON/interval) workflow at all? */
function isScheduledWorkflow(wf: WorkflowDoc): boolean {
    const event = String(wf.trigger?.event ?? '').toLowerCase();
    if (SCHEDULE_EVENTS.has(event)) return true;
    const cfg = wf.trigger?.config ?? {};
    return (
        cfg.schedule !== undefined ||
        cfg.cron !== undefined ||
        cfg.intervalMinutes !== undefined ||
        cfg.interval !== undefined
    );
}

/**
 * Derive an interval (ms) for a workflow. Prefers an explicit
 * `trigger.config.intervalMinutes` / `interval`; otherwise interprets a small
 * set of common cron strings; otherwise falls back to the default. Never
 * throws.
 */
function resolveIntervalMs(wf: WorkflowDoc): number {
    const cfg = wf.trigger?.config ?? {};
    const explicit = Number(cfg.intervalMinutes ?? cfg.interval);
    if (Number.isFinite(explicit) && explicit > 0) {
        return explicit * 60_000;
    }
    const cron = String(cfg.cron ?? cfg.schedule ?? '').trim();
    if (cron) {
        // `* * * * *` → every minute.
        if (cron === '* * * * *') return 60_000;
        // `*/N * * * *` → every N minutes.
        const everyN = cron.match(/^\*\/(\d+)\s+\*\s+\*\s+\*\s+\*$/);
        if (everyN) {
            const n = Number(everyN[1]);
            if (Number.isFinite(n) && n > 0) return n * 60_000;
        }
        // `<m> * * * *` (fixed minute, every hour) → hourly.
        if (/^\d+\s+\*\s+\*\s+\*\s+\*$/.test(cron)) return 60 * 60_000;
        // `<m> <h> * * *` (daily at a fixed time) → daily.
        if (/^\d+\s+\d+\s+\*\s+\*\s+\*$/.test(cron)) return 24 * 60 * 60_000;
    }
    return DEFAULT_INTERVAL_MINUTES * 60_000;
}

/** Parse a `lastRunAt` field (Date | ISO string) to epoch ms, or null. */
function lastRunMs(wf: WorkflowDoc): number | null {
    const v = wf.lastRunAt;
    if (!v) return null;
    const t = v instanceof Date ? v.getTime() : Date.parse(String(v));
    return Number.isFinite(t) ? t : null;
}

/** Is this scheduled workflow due to run right now? */
function isDue(wf: WorkflowDoc, now: number): boolean {
    const last = lastRunMs(wf);
    if (last == null) return true; // never run → fire now.
    return now - last >= resolveIntervalMs(wf);
}

// ---------------------------------------------------------------------------
// Step execution via the service token
// ---------------------------------------------------------------------------

/** Per-step record persisted on a workflow run. */
interface RecordedStep {
    id: string;
    type: string;
    status: 'success' | 'failed' | 'skipped';
    output?: Record<string, unknown>;
    error?: string;
}

function cfgStr(
    config: Record<string, unknown>,
    key: string,
): string | undefined {
    const v = config?.[key];
    if (typeof v === 'string' && v.length > 0) return v;
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    return undefined;
}

/**
 * Execute one workflow step against the engine using the system service token,
 * scoped to `projectId`. Mirrors the side-effect actions in `runtime.ts`
 * (`create_task` → activities, `send_notification` → notifications,
 * `update_field` / `upsert_record` → records, `webhook` → outbound POST), but
 * with no `{{ }}` var resolution (the cron has no per-record trigger payload to
 * resolve against). Never throws — returns a structured outcome.
 */
async function runStep(
    projectId: string,
    step: WorkflowStepDoc,
    targetObject: string,
): Promise<RecordedStep> {
    const id = step.id ?? 'step';
    const type = String(step.type ?? '').toLowerCase();
    const config = (step.config ?? {}) as Record<string, unknown>;
    try {
        switch (type) {
            case 'create_task': {
                await rustServiceFetch('/v1/sabcrm/activities', {
                    projectId,
                    method: 'POST',
                    body: JSON.stringify({
                        projectId,
                        type: 'TASK',
                        title: cfgStr(config, 'title') ?? 'Scheduled workflow task',
                        body: cfgStr(config, 'body') ?? '',
                        targetObject: targetObject || undefined,
                        authorId: 'system',
                        status: 'TODO',
                    }),
                });
                return { id, type: step.type ?? type, status: 'success' };
            }
            case 'send_notification': {
                const userId = cfgStr(config, 'userId');
                if (!userId) {
                    return {
                        id,
                        type: step.type ?? type,
                        status: 'failed',
                        error: 'send_notification: missing userId (no session actor in cron)',
                    };
                }
                await rustServiceFetch('/v1/sabcrm/notifications', {
                    projectId,
                    method: 'POST',
                    body: JSON.stringify({
                        projectId,
                        userId,
                        kind: 'system',
                        title: cfgStr(config, 'title') ?? 'Scheduled workflow',
                        body: cfgStr(config, 'body'),
                        targetObject: targetObject || undefined,
                    }),
                });
                return { id, type: step.type ?? type, status: 'success' };
            }
            case 'update_field': {
                const field = cfgStr(config, 'field');
                const recordId = cfgStr(config, 'recordId') ?? cfgStr(config, 'id');
                const target = cfgStr(config, 'object') ?? targetObject;
                if (!field || !recordId || !target) {
                    return {
                        id,
                        type: step.type ?? type,
                        status: 'failed',
                        error: 'update_field: needs object + recordId + field',
                    };
                }
                await rustServiceFetch(
                    `/v1/sabcrm/records/${encodeURIComponent(target)}/${encodeURIComponent(recordId)}`,
                    {
                        projectId,
                        method: 'PATCH',
                        body: JSON.stringify({
                            projectId,
                            data: { [field]: config.value },
                        }),
                    },
                );
                return { id, type: step.type ?? type, status: 'success', output: { field } };
            }
            case 'upsert_record':
            case 'create_record': {
                const target = cfgStr(config, 'object') ?? targetObject;
                if (!target) {
                    return {
                        id,
                        type: step.type ?? type,
                        status: 'failed',
                        error: 'upsert_record: missing object',
                    };
                }
                const data =
                    config.data && typeof config.data === 'object'
                        ? (config.data as Record<string, unknown>)
                        : {};
                const created = await rustServiceFetch<{ record?: { id?: string }; id?: string }>(
                    `/v1/sabcrm/records/${encodeURIComponent(target)}`,
                    {
                        projectId,
                        method: 'POST',
                        body: JSON.stringify({ projectId, data, createdBy: 'system' }),
                    },
                );
                return {
                    id,
                    type: step.type ?? type,
                    status: 'success',
                    output: { id: created?.record?.id ?? created?.id },
                };
            }
            case 'webhook': {
                const url = cfgStr(config, 'url');
                if (!url) {
                    return { id, type: step.type ?? type, status: 'failed', error: 'webhook: missing url' };
                }
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({
                        projectId,
                        source: 'sabcrm-scheduler',
                        step: id,
                        payload: config.payload ?? config.body ?? undefined,
                    }),
                });
                return { id, type: step.type ?? type, status: 'success', output: { status: res.status } };
            }
            default:
                return {
                    id,
                    type: step.type ?? type,
                    status: 'skipped',
                    error: `unsupported step type in scheduler: ${step.type}`,
                };
        }
    } catch (err) {
        return {
            id,
            type: step.type ?? type,
            status: 'failed',
            error: err instanceof Error ? err.message : 'step error',
        };
    }
}

/** Run every step of a workflow in order. Best-effort; never throws. */
async function runWorkflowSteps(
    projectId: string,
    steps: WorkflowStepDoc[],
    targetObject: string,
): Promise<{ stepsRun: number; stepsFailed: number; recorded: RecordedStep[] }> {
    let stepsRun = 0;
    let stepsFailed = 0;
    const recorded: RecordedStep[] = [];
    for (const step of steps ?? []) {
        const out = await runStep(projectId, step, targetObject);
        recorded.push(out);
        if (out.status === 'success') stepsRun += 1;
        else if (out.status === 'failed') stepsFailed += 1;
    }
    return { stepsRun, stepsFailed, recorded };
}

// ---------------------------------------------------------------------------
// Durable run recording (best-effort, via the service token)
// ---------------------------------------------------------------------------

const RUNS_BASE = '/v1/sabcrm/workflow-runs';

/** Open a `running` run; returns its id or undefined. Best-effort. */
async function openRun(
    projectId: string,
    workflowId: string,
    trigger: unknown,
): Promise<string | undefined> {
    try {
        const res = await rustServiceFetch<{ run?: { id?: string }; id?: string }>(RUNS_BASE, {
            projectId,
            method: 'POST',
            body: JSON.stringify({
                projectId,
                workflowId,
                status: 'running',
                trigger,
                steps: [],
            }),
        });
        return res?.run?.id ?? res?.id;
    } catch {
        return undefined;
    }
}

/** Finalize a run with its terminal status + per-step record. Best-effort. */
async function closeRun(
    projectId: string,
    runId: string | undefined,
    status: 'success' | 'failed',
    steps: RecordedStep[],
): Promise<void> {
    if (!runId) return;
    try {
        await rustServiceFetch(`${RUNS_BASE}/${encodeURIComponent(runId)}`, {
            projectId,
            method: 'PATCH',
            body: JSON.stringify({
                projectId,
                status,
                steps,
                finishedAt: new Date().toISOString(),
            }),
        });
    } catch {
        // best-effort
    }
}

/**
 * Run one workflow end-to-end with a durable run wrapped around it. Returns the
 * per-workflow report line. Never throws.
 */
async function executeWorkflow(
    wf: WorkflowDoc,
    triggerLabel: Record<string, unknown>,
): Promise<SchedulerItemReport> {
    const projectId = String(wf.projectId ?? '');
    const workflowId = wf._id instanceof ObjectId ? wf._id.toHexString() : String(wf._id);
    if (!projectId) {
        return { workflowId, projectId, status: 'skipped', detail: 'workflow has no projectId' };
    }
    const targetObject = String(wf.trigger?.object ?? '');
    const runId = await openRun(projectId, workflowId, triggerLabel);
    const { stepsRun, stepsFailed, recorded } = await runWorkflowSteps(
        projectId,
        wf.steps ?? [],
        targetObject,
    );
    await closeRun(projectId, runId, stepsFailed > 0 ? 'failed' : 'success', recorded);
    return {
        workflowId,
        projectId,
        status: stepsFailed > 0 && stepsRun === 0 ? 'failed' : 'ran',
        stepsRun,
        stepsFailed,
    };
}

/** Stamp `lastRunAt` on the workflow doc so the next due-check is correct. */
async function stampLastRun(workflowId: ObjectId | string, when: Date): Promise<void> {
    try {
        const { db } = await connectToDatabase();
        const id =
            workflowId instanceof ObjectId
                ? workflowId
                : ObjectId.isValid(workflowId)
                  ? new ObjectId(workflowId)
                  : null;
        if (!id) return;
        await db
            .collection(WORKFLOWS_COLL)
            .updateOne({ _id: id }, { $set: { lastRunAt: when.toISOString() } });
    } catch {
        // best-effort
    }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Fire all due CRON/schedule workflows and retry the most recent failed runs.
 * Best-effort throughout — returns a `{ ran, failed, summary }` report and
 * never throws. If the engine / `RUST_API_URL` is unset or unreachable, the
 * calls fail gracefully and the report says so (`engineReachable: false`).
 */
export async function runDueWorkflows(): Promise<SchedulerReport> {
    const startedAt = Date.now();
    const now = startedAt;
    const report: SchedulerReport = {
        ran: 0,
        failed: 0,
        summary: '',
        engineReachable: true,
        scheduled: [],
        retried: [],
        durationMs: 0,
    };

    let db;
    try {
        ({ db } = await connectToDatabase());
    } catch (e) {
        report.summary = `DB unavailable: ${e instanceof Error ? e.message : String(e)}`;
        report.engineReachable = false;
        report.durationMs = Date.now() - startedAt;
        return report;
    }

    // --- 1. Due scheduled workflows ----------------------------------------
    try {
        const candidates = (await db
            .collection(WORKFLOWS_COLL)
            .find({ enabled: true })
            .limit(500)
            .toArray()) as unknown as WorkflowDoc[];

        const due = candidates
            .filter((wf) => isScheduledWorkflow(wf) && isDue(wf, now))
            .slice(0, MAX_WORKFLOWS_PER_RUN);

        for (const wf of due) {
            const line = await executeWorkflow(wf, { kind: 'schedule', firedAt: new Date(now).toISOString() });
            report.scheduled.push(line);
            if (line.status === 'ran') report.ran += 1;
            else if (line.status === 'failed') report.failed += 1;
            // Always stamp lastRunAt on an attempt so a hard-failing workflow
            // doesn't hot-loop every invocation.
            await stampLastRun(wf._id, new Date(now));
            // Detect a wholly-unreachable engine: every step failing on the
            // first workflow is a strong signal RUST_API_URL is unset/down.
            if (line.status === 'failed' && (line.stepsRun ?? 0) === 0 && report.scheduled.length === 1) {
                report.engineReachable = false;
            }
        }
    } catch (e) {
        report.scheduled.push({
            workflowId: '-',
            projectId: '-',
            status: 'failed',
            detail: `scheduled pass error: ${e instanceof Error ? e.message : String(e)}`,
        });
        report.failed += 1;
    }

    // --- 2. Retry recent failed runs ---------------------------------------
    try {
        const failedRuns = (await db
            .collection(RUNS_COLL)
            .find({ status: 'failed' })
            .sort({ _id: -1 })
            .limit(MAX_RETRIES_PER_RUN)
            .toArray()) as unknown as RunDoc[];

        for (const run of failedRuns) {
            const projectId = String(run.projectId ?? '');
            const workflowId = String(run.workflowId ?? '');
            if (!projectId || !workflowId || !ObjectId.isValid(workflowId)) {
                report.retried.push({
                    workflowId: workflowId || '-',
                    projectId: projectId || '-',
                    status: 'skipped',
                    detail: 'failed run missing projectId/workflowId',
                });
                continue;
            }
            // Re-load the parent workflow so we re-run its current steps.
            const wf = (await db
                .collection(WORKFLOWS_COLL)
                .findOne({ _id: new ObjectId(workflowId) })) as unknown as WorkflowDoc | null;
            if (!wf) {
                report.retried.push({
                    workflowId,
                    projectId,
                    status: 'skipped',
                    detail: 'parent workflow no longer exists',
                });
                continue;
            }
            const line = await executeWorkflow(wf, {
                kind: 'retry',
                ofRun: run._id instanceof ObjectId ? run._id.toHexString() : String(run._id),
                firedAt: new Date(now).toISOString(),
            });
            report.retried.push(line);
            if (line.status === 'ran') report.ran += 1;
            else if (line.status === 'failed') report.failed += 1;
        }
    } catch (e) {
        report.retried.push({
            workflowId: '-',
            projectId: '-',
            status: 'failed',
            detail: `retry pass error: ${e instanceof Error ? e.message : String(e)}`,
        });
        report.failed += 1;
    }

    report.durationMs = Date.now() - startedAt;
    report.summary =
        `Fired ${report.scheduled.filter((s) => s.status === 'ran').length} scheduled workflow(s), ` +
        `retried ${report.retried.filter((r) => r.status === 'ran').length} failed run(s); ` +
        `${report.ran} ran, ${report.failed} failed` +
        (report.engineReachable ? '' : ' (engine appears unreachable — check RUST_API_URL)');
    return report;
}
