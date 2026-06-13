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
 * 3. **`time.elapsed` workflows** (ported legacy-CRM `time_elapsed` trigger).
 *    For each enabled workflow whose `trigger.event` is `time.elapsed`, scan
 *    the trigger object's live records and fire once per record idle longer
 *    than `afterMinutes/afterHours/afterDays` (anchored on `sinceField`,
 *    default `updatedAt`). Durable per-record dedupe via the recorded run's
 *    `{ kind: 'time.elapsed', recordId }` trigger.
 * 4. **Deal rotting.** For every pipeline stage declaring `rottingDays`
 *    (stage governance, `sabcrm-pipelines`), tag records idle past the
 *    threshold with the per-project "Rotting" tag (a `sabcrm_tag_assignments`
 *    upsert — chosen over a record field because tagging must NOT bump the
 *    record's `updatedAt`, which is the idle clock), and untag records that
 *    woke up, moved stage, or were trashed.
 * 5. **Sequence enrollments** (crate `sabcrm-sequences`). Pop due
 *    enrollments (`status: "active"`, `nextRunAt <= now`, capped per tick)
 *    and execute ONE step each: `email` renders through the
 *    `sabcrm-templates` `{{variable}}` engine (stored template or inline
 *    subject/body) and sends via the tenant owner's transport
 *    (`dispatchTransactionalEmail`); `task` creates a TASK activity
 *    (`sabcrm-activities`); `wait` advances `nextRunAt` by `waitDays`.
 *    The step index advances, history is appended, and the enrollment
 *    completes after the last step. Auto-unenroll (reply / stage change)
 *    lives in `src/lib/sabcrm/sequences.server.ts`, not here.
 * 6. **AI computed fields** (`FieldType: 'AI'`, config in `settings.ai`).
 *    Discover objects carrying AI fields from `sabcrm_objects`, and for each
 *    auto-refresh field recompute records whose prompt inputs changed
 *    (sha256 dirty-hash in `data.__ai.<key>.inputsHash`). Rows are CLAIMED
 *    single-winner, the project owner's `ai_requests` quota gates each LLM
 *    call, and writes go DIRECT to Mongo without bumping `updatedAt` (an AI
 *    write must not reset the idle clocks of passes 3–4 or re-trigger
 *    record-change workflows). Evaluator: `src/lib/sabcrm/ai-fields.server.ts`.
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
import { dispatchTransactionalEmail } from '@/lib/email-dispatcher';
import { canUse } from '@/lib/billing/entitlements';
import { recordUsage } from '@/lib/billing/usage-meter';
import { aiFieldConfig, type FieldMetadata } from './types';
import { aiSourceFields, aiSourceValue, aiInputsHash } from './ai-fields';
import { evaluateAiField } from './ai-fields.server';
import {
  listProjectsWithScoring,
  recomputeAllProjectScores,
} from './scoring.server';
import {
  listProjectsWithFormulas,
  recomputeAllProjectFormulas,
} from './formula.server';
import {
  listProjectsWithEmbeddings,
  reindexAllProjectEmbeddings,
} from './embeddings.server';

// ---------------------------------------------------------------------------
// Caps — keep one invocation well inside the 300s function budget.
// ---------------------------------------------------------------------------

/** Max scheduled workflows fired per invocation. */
const MAX_WORKFLOWS_PER_RUN = 25;
/** Max failed runs retried per invocation. */
const MAX_RETRIES_PER_RUN = 10;
/** Default interval (minutes) when a schedule can't be parsed. */
const DEFAULT_INTERVAL_MINUTES = 60;
/** Max `time.elapsed` workflows evaluated per invocation. */
const MAX_TIME_WORKFLOWS_PER_RUN = 10;
/** Max candidate records scanned per `time.elapsed` workflow. */
const MAX_RECORDS_PER_TIME_WORKFLOW = 200;
/** Max records fired (workflow executed) per `time.elapsed` workflow per tick. */
const MAX_FIRES_PER_TIME_WORKFLOW = 25;
/** Max pipelines examined for deal rotting per invocation. */
const MAX_ROTTING_PIPELINES_PER_RUN = 25;
/** Max records scanned per rotting stage per invocation. */
const MAX_RECORDS_PER_ROTTING_STAGE = 200;
/** Max due sequence enrollments executed (ONE step each) per invocation. */
const MAX_SEQUENCE_ENROLLMENTS_PER_RUN = 50;
/**
 * How far a claimed enrollment's `nextRunAt` is pushed before its step runs.
 * If the tick crashes mid-step the enrollment retries after this delay
 * instead of hot-looping; the success path overwrites it.
 */
const SEQUENCE_CLAIM_DELAY_MS = 10 * 60_000;
/** Max `(project, object)` pairs scanned for AI fields per invocation. */
const MAX_AI_FIELD_OBJECTS_PER_RUN = 10;
/** Max AI-field LLM calls per tick (~1–3 s each — keep inside the budget). */
const MAX_AI_FIELD_EVALS_PER_RUN = 20;
/** Max records scanned per AI field per invocation. */
const MAX_RECORDS_PER_AI_FIELD = 200;
/** Max projects swept by the rule-based scoring backstop per invocation. */
const MAX_SCORING_PROJECTS_PER_RUN = 25;
/** Max records re-scored per object by the scoring backstop per invocation. */
const MAX_SCORING_RECORDS_PER_OBJECT = 500;
/**
 * How long a claimed (`pending`) AI-field row blocks re-evaluation. If the
 * tick crashes mid-LLM-call the row retries after this delay instead of
 * hot-looping (mirrors {@link SEQUENCE_CLAIM_DELAY_MS}).
 */
const AI_FIELD_CLAIM_DELAY_MS = 10 * 60_000;

const WORKFLOWS_COLL = 'sabcrm_workflows';
const OBJECTS_COLL = 'sabcrm_objects';
const RUNS_COLL = 'sabcrm_workflow_runs';
const RECORDS_COLL = 'sabcrm_records';
const PIPELINES_COLL = 'sabcrm_pipelines';
const TAGS_COLL = 'sabcrm_tags';
const TAG_ASSIGNMENTS_COLL = 'sabcrm_tag_assignments';
const SEQUENCES_COLL = 'sabcrm_sequences';
const SEQ_ENROLLMENTS_COLL = 'sabcrm_sequence_enrollments';
const PROJECTS_COLL = 'projects';

/**
 * The well-known tag stamped on idle ("rotting") pipeline records. Chosen over
 * a record `data.*` flag because applying/removing a tag lives in the
 * `sabcrm_tag_assignments` join table and does NOT bump the record's
 * `updatedAt` — a data-field write would reset the very idle clock the rotting
 * check reads, making records flap in and out of rot every tick. Tag
 * assignments are also already surfaced in the tags UI / `for-record` API.
 */
const ROTTING_TAG_NAME = 'Rotting';
const ROTTING_TAG_COLOR = '#ef4444';

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

/** Per-pipeline rotting outcome line in the report. */
export interface RottingItemReport {
    pipelineId: string;
    projectId: string;
    /** Records newly tagged as rotting this tick. */
    tagged: number;
    /** Stale assignments removed (record fresh again / moved / gone). */
    untagged: number;
    /** Failure detail when the pipeline pass errored. */
    detail?: string;
}

/** Per-enrollment sequence outcome line in the report. */
export interface SequenceItemReport {
    enrollmentId: string;
    sequenceId: string;
    projectId: string;
    /** `ran` (a step executed) | `skipped` | `failed`. */
    status: 'ran' | 'skipped' | 'failed';
    /** The step kind executed / the skip or failure detail. */
    detail?: string;
}

/** Per-record AI-field outcome line in the report. */
export interface AiFieldItemReport {
    projectId: string;
    objectSlug: string;
    fieldKey: string;
    recordId: string;
    /** `ran` (a value was computed) | `skipped` | `failed`. */
    status: 'ran' | 'skipped' | 'failed';
    /** The skip or failure detail. */
    detail?: string;
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
    /**
     * `time.elapsed` workflow outcomes — one line per (workflow, due record)
     * fired this tick. Additive; absent entries mean nothing was due.
     */
    timeElapsed: SchedulerItemReport[];
    /** Deal-rotting outcomes, one line per pipeline with rotting stages. */
    rotting: RottingItemReport[];
    /**
     * Sequence-enrollment outcomes — one line per due enrollment processed
     * this tick. Additive; absent entries mean nothing was due.
     */
    sequences: SequenceItemReport[];
    /**
     * AI computed-field outcomes — one line per record claimed/evaluated this
     * tick (steady-state in-sync records produce NO line). Additive.
     */
    aiFields: AiFieldItemReport[];
    /**
     * Rule-based scoring backstop outcomes — one line per object swept this
     * tick (records changed out-of-band, e.g. CSV import / public API / the
     * Rust write path). Additive; in-sync records produce no work.
     */
    scores: ScoreSweepReport[];
    /** Milliseconds spent. */
    durationMs: number;
}

/** One scoring-sweep line: an object whose records were re-scored this tick. */
export interface ScoreSweepReport {
    projectId: string;
    objectSlug: string;
    scanned: number;
    updated: number;
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
    /**
     * The record this execution is anchored to, when the firing trigger is
     * record-scoped (`time.elapsed`). Used as the fallback `recordId` for
     * `update_field` and as `targetRecordId` for `create_task`, so per-record
     * triggers act on THEIR record without per-step configuration.
     */
    contextRecordId?: string,
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
                        targetRecordId: contextRecordId || undefined,
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
                const recordId =
                    cfgStr(config, 'recordId') ?? cfgStr(config, 'id') ?? contextRecordId;
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
                        recordId: contextRecordId || undefined,
                        payload: config.payload ?? config.body ?? undefined,
                    }),
                });
                return { id, type: step.type ?? type, status: 'success', output: { status: res.status } };
            }
            case 'send_whatsapp_template': {
                // Ported legacy-CRM action — sends through the existing WaChat
                // surface (`POST /v1/wachat/templates/{id}/send`). The scheduler
                // has no `{{ }}` context, so `to` must be a literal phone here;
                // the inline runtime path (runtime.ts) supports templating.
                const templateId = cfgStr(config, 'templateId');
                const to =
                    cfgStr(config, 'to') ??
                    cfgStr(config, 'recipientPhone') ??
                    cfgStr(config, 'phone');
                if (!templateId || !to) {
                    return {
                        id,
                        type: step.type ?? type,
                        status: 'failed',
                        error: 'send_whatsapp_template: needs templateId + a literal `to` phone (no {{ }} context in the scheduler)',
                    };
                }
                const named: Record<string, string> = {};
                const rawVars = config.variables;
                if (rawVars && typeof rawVars === 'object' && !Array.isArray(rawVars)) {
                    for (const [k, v] of Object.entries(rawVars as Record<string, unknown>)) {
                        if (v === undefined || v === null) continue;
                        named[k] = typeof v === 'string' ? v : String(v);
                    }
                }
                const out = await rustServiceFetch<{ wamid?: string }>(
                    `/v1/wachat/templates/${encodeURIComponent(templateId)}/send`,
                    {
                        projectId,
                        method: 'POST',
                        body: JSON.stringify({
                            recipientPhone: to,
                            variables: { named },
                            mediaId: cfgStr(config, 'mediaId'),
                        }),
                    },
                );
                return {
                    id,
                    type: step.type ?? type,
                    status: 'success',
                    output: { wamid: out?.wamid, to },
                };
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
    contextRecordId?: string,
): Promise<{ stepsRun: number; stepsFailed: number; recorded: RecordedStep[] }> {
    let stepsRun = 0;
    let stepsFailed = 0;
    const recorded: RecordedStep[] = [];
    for (const step of steps ?? []) {
        const out = await runStep(projectId, step, targetObject, contextRecordId);
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
    contextRecordId?: string,
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
        contextRecordId,
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
// time.elapsed — per-record idle triggers (ported legacy-CRM `time_elapsed`)
// ---------------------------------------------------------------------------

/** Event slugs recognised as the time-based trigger. */
const TIME_ELAPSED_EVENTS = new Set(['time.elapsed', 'time_elapsed']);

/** Loose record document shape (Mongo `sabcrm_records`, read directly). */
interface RecordDoc {
    _id: ObjectId | string;
    projectId?: string;
    object?: string;
    data?: Record<string, unknown>;
    createdAt?: string | Date;
    updatedAt?: string | Date;
    deletedAt?: string | Date | null;
}

/** Hex-stringify a Mongo `_id` regardless of stored type. */
function idHex(id: ObjectId | string): string {
    return id instanceof ObjectId ? id.toHexString() : String(id);
}

/** Parse a Date | RFC3339 string to epoch ms, or null. */
function parseMs(v: unknown): number | null {
    if (!v) return null;
    const t = v instanceof Date ? v.getTime() : Date.parse(String(v));
    return Number.isFinite(t) ? t : null;
}

/** Is this an enabled `time.elapsed` workflow? */
function isTimeElapsedWorkflow(wf: WorkflowDoc): boolean {
    return TIME_ELAPSED_EVENTS.has(String(wf.trigger?.event ?? '').toLowerCase());
}

/**
 * The idle threshold (ms) of a `time.elapsed` trigger. Duration keys may ride
 * flattened on the trigger (the builder shape) or under `trigger.config`;
 * both are merged. `afterMinutes + afterHours + afterDays` compose; the
 * legacy-CRM `elapsedMinutes` key is honoured as an additional alias.
 * `0` → the trigger is disabled (mirrors `TimeElapsedConfig::total_minutes`).
 */
function timeElapsedThresholdMs(wf: WorkflowDoc): number {
    const trigger = (wf.trigger ?? {}) as Record<string, unknown>;
    const cfg = {
        ...trigger,
        ...((trigger.config ?? {}) as Record<string, unknown>),
    };
    const num = (k: string): number => {
        const n = Number(cfg[k]);
        return Number.isFinite(n) && n > 0 ? n : 0;
    };
    const minutes =
        num('afterMinutes') +
        num('afterHours') * 60 +
        num('afterDays') * 60 * 24 +
        num('elapsedMinutes');
    return minutes * 60_000;
}

/** The `sinceField` of a `time.elapsed` trigger (default `updatedAt`). */
function timeElapsedSinceField(wf: WorkflowDoc): string {
    const trigger = (wf.trigger ?? {}) as Record<string, unknown>;
    const cfg = (trigger.config ?? {}) as Record<string, unknown>;
    const v = cfg.sinceField ?? trigger.sinceField;
    return typeof v === 'string' && v.trim() ? v.trim() : 'updatedAt';
}

/**
 * The epoch-ms anchor a record's elapsed time is measured from.
 * `updatedAt` / `createdAt` read the top-level record timestamps; any other
 * `sinceField` reads `data.<sinceField>` (expected to be a date / RFC3339).
 */
function recordAnchorMs(rec: RecordDoc, sinceField: string): number | null {
    if (sinceField === 'updatedAt') return parseMs(rec.updatedAt);
    if (sinceField === 'createdAt') return parseMs(rec.createdAt);
    return parseMs(rec.data?.[sinceField]);
}

// ---------------------------------------------------------------------------
// Deal rotting — tag idle pipeline records (stage `rottingDays` governance)
// ---------------------------------------------------------------------------

/** Loose pipeline document shape (Mongo `sabcrm_pipelines`, read directly). */
interface PipelineDoc {
    _id: ObjectId | string;
    projectId?: string;
    object?: string;
    /** `data.<field>` carrying the stage id; board default is `stage`. */
    stageField?: string;
    stages?: Array<{ id?: unknown; label?: string; rottingDays?: unknown }>;
}

/** Loose tag-assignment row shape (Mongo `sabcrm_tag_assignments`). */
interface TagAssignmentDoc {
    _id: ObjectId | string;
    projectId?: string;
    tagId?: string;
    object?: string;
    recordId?: string;
}

/**
 * Find-or-create the per-project "Rotting" tag and return its hex id.
 * Mirrors the `sabcrm-tags` crate's document shape exactly
 * (`{ _id, projectId, name, color, createdAt }`, `createdAt` RFC3339).
 */
async function ensureRottingTagId(
    db: Awaited<ReturnType<typeof connectToDatabase>>['db'],
    projectId: string,
): Promise<string> {
    const tags = db.collection(TAGS_COLL);
    const existing = await tags.findOne({ projectId, name: ROTTING_TAG_NAME });
    if (existing) return idHex(existing._id as ObjectId | string);
    const _id = new ObjectId();
    await tags.insertOne({
        _id,
        projectId,
        name: ROTTING_TAG_NAME,
        color: ROTTING_TAG_COLOR,
        createdAt: new Date().toISOString(),
    });
    return _id.toHexString();
}

/**
 * Evaluate deal rotting for one (projectId, object, stageField) group of
 * pipelines whose stages declare `rottingDays`:
 *
 * 1. **Tag** — records sitting in a rotting stage whose `updatedAt` is older
 *    than that stage's threshold get the "Rotting" tag (upsert into the
 *    `sabcrm_tag_assignments` join table, exactly like the Rust `apply`
 *    handler — idempotent, and crucially does NOT bump the record's
 *    `updatedAt`, so tagging never resets the idle clock it measures).
 * 2. **Un-tag** — existing Rotting assignments whose record is gone, trashed,
 *    freshly updated, or moved to a non-rotting stage are removed.
 *
 * Pipelines sharing a (project, object, stageField) are merged so one
 * pipeline's cleanup never deletes another's freshly-applied tag.
 */
async function evaluateRottingGroup(
    db: Awaited<ReturnType<typeof connectToDatabase>>['db'],
    projectId: string,
    object: string,
    stageField: string,
    pipelineIds: string[],
    rottingDaysByStage: Map<string, number>,
    now: number,
): Promise<RottingItemReport> {
    const line: RottingItemReport = {
        pipelineId: pipelineIds.join(','),
        projectId,
        tagged: 0,
        untagged: 0,
    };
    const tagId = await ensureRottingTagId(db, projectId);
    const records = db.collection(RECORDS_COLL);
    const assigns = db.collection(TAG_ASSIGNMENTS_COLL);
    const dayMs = 24 * 60 * 60_000;

    // --- 1. Tag idle records, stage by stage -------------------------------
    for (const [stageId, days] of rottingDaysByStage) {
        const cutoff = now - days * dayMs;
        const recs = (await records
            .find({
                projectId,
                object,
                [`data.${stageField}`]: stageId,
                deletedAt: { $in: [null] },
            })
            .limit(MAX_RECORDS_PER_ROTTING_STAGE)
            .toArray()) as unknown as RecordDoc[];
        for (const rec of recs) {
            const updated = parseMs(rec.updatedAt);
            if (updated == null || updated > cutoff) continue; // still fresh
            const recordId = idHex(rec._id);
            const res = await assigns.updateOne(
                { projectId, tagId, object, recordId },
                {
                    $setOnInsert: {
                        _id: new ObjectId(),
                        createdAt: new Date(now).toISOString(),
                    },
                },
                { upsert: true },
            );
            if (res.upsertedCount) line.tagged += 1;
        }
    }

    // --- 2. Remove stale assignments ----------------------------------------
    const existing = (await assigns
        .find({ projectId, tagId, object })
        .limit(500)
        .toArray()) as unknown as TagAssignmentDoc[];
    if (existing.length === 0) return line;

    const oids = existing
        .map((a) => String(a.recordId ?? ''))
        .filter((rid) => ObjectId.isValid(rid))
        .map((rid) => new ObjectId(rid));
    const found = (await records
        .find({ _id: { $in: oids } })
        .toArray()) as unknown as RecordDoc[];
    const byId = new Map(found.map((r) => [idHex(r._id), r]));

    for (const a of existing) {
        const rid = String(a.recordId ?? '');
        const rec = byId.get(rid);
        let stillRotting = false;
        if (rec && !rec.deletedAt) {
            const stageId = String(rec.data?.[stageField] ?? '');
            const days = rottingDaysByStage.get(stageId);
            const updated = parseMs(rec.updatedAt);
            if (days && updated != null && updated <= now - days * dayMs) {
                stillRotting = true;
            }
        }
        if (!stillRotting) {
            // `_id` is ObjectId in practice (both the Rust `apply` handler and
            // `ensureRottingTagId`'s upsert insert ObjectIds); the cast only
            // widens the untyped collection's filter — the runtime value is
            // passed through unchanged, so a legacy string id still matches.
            await assigns.deleteOne({ _id: a._id as ObjectId });
            line.untagged += 1;
        }
    }
    return line;
}

// ---------------------------------------------------------------------------
// Sequence enrollments — execute due cadence steps (crate `sabcrm-sequences`)
// ---------------------------------------------------------------------------

/** Loose sequence-step shape (typed/validated by the Rust crate on write). */
interface SequenceStepDoc {
    id?: string;
    kind?: string;
    email?: { templateId?: string; subject?: string; body?: string };
    task?: { title?: string; dueInDays?: number };
    waitDays?: number;
}

/** Loose sequence document shape (Mongo `sabcrm_sequences`, read directly). */
interface SequenceDoc {
    _id: ObjectId | string;
    projectId?: string;
    name?: string;
    status?: string;
    steps?: SequenceStepDoc[];
}

/** Loose enrollment document shape (Mongo `sabcrm_sequence_enrollments`). */
interface EnrollmentDoc {
    _id: ObjectId | string;
    projectId?: string;
    sequenceId?: string;
    objectSlug?: string;
    recordId?: string;
    currentStepIndex?: number;
    status?: string;
    nextRunAt?: string | Date;
    enrolledBy?: string;
}

/** The `{ subject?, body, missingVariables }` envelope templates render to. */
interface RenderedTemplate {
    subject?: string;
    body?: string;
}

/**
 * Resolve the tenant owner userId of a SabNode project (`projects.userId`) —
 * the id `dispatchTransactionalEmail` resolves `email_settings` by. Cached
 * per tick by the caller. Returns undefined when the project is gone.
 */
async function resolveProjectOwner(
    db: Awaited<ReturnType<typeof connectToDatabase>>['db'],
    projectId: string,
): Promise<string | undefined> {
    if (!ObjectId.isValid(projectId)) return undefined;
    const project = await db
        .collection(PROJECTS_COLL)
        .findOne({ _id: new ObjectId(projectId) }, { projection: { userId: 1 } });
    const owner = project?.userId;
    if (!owner) return undefined;
    return owner instanceof ObjectId ? owner.toHexString() : String(owner);
}

/**
 * Pull a send-to email address out of a record's `data` bag. Accepts the
 * conventional flat `email` key plus the Twenty-style `emails.primaryEmail`
 * nesting used by imported objects.
 */
function extractRecordEmail(data: Record<string, unknown> | undefined): string | undefined {
    if (!data) return undefined;
    const flat = data.email ?? data.primaryEmail;
    if (typeof flat === 'string' && flat.trim()) return flat.trim();
    const nested = data.emails;
    if (nested && typeof nested === 'object') {
        const primary = (nested as { primaryEmail?: unknown }).primaryEmail;
        if (typeof primary === 'string' && primary.trim()) return primary.trim();
    }
    return undefined;
}

/**
 * Render template strings against a record through the `sabcrm-templates`
 * engine (the SAME `{{variable}}` interpolation every template feature uses):
 * a stored template renders via `POST /templates/{id}/render`, an inline
 * subject/body via `POST /templates/preview`. Throws on engine failure —
 * the caller records the failure on the enrollment.
 */
async function renderSequenceEmail(
    projectId: string,
    objectSlug: string,
    recordId: string,
    email: { templateId?: string; subject?: string; body?: string },
): Promise<RenderedTemplate> {
    if (email.templateId) {
        return rustServiceFetch<RenderedTemplate>(
            `/v1/sabcrm/templates/${encodeURIComponent(email.templateId)}/render`,
            {
                projectId,
                method: 'POST',
                body: JSON.stringify({ projectId, object: objectSlug, recordId }),
            },
        );
    }
    return rustServiceFetch<RenderedTemplate>('/v1/sabcrm/templates/preview', {
        projectId,
        method: 'POST',
        body: JSON.stringify({
            projectId,
            subject: email.subject,
            body: email.body ?? '',
            object: objectSlug,
            recordId,
        }),
    });
}

/**
 * Execute ONE due enrollment's current step and advance its state machine.
 * Never throws — failures land on the enrollment (`status: 'failed'`) and in
 * the returned report line.
 */
async function runEnrollmentStep(
    db: Awaited<ReturnType<typeof connectToDatabase>>['db'],
    enrollment: EnrollmentDoc,
    sequence: SequenceDoc,
    ownerByProject: Map<string, string | undefined>,
    now: number,
): Promise<SequenceItemReport> {
    const projectId = String(enrollment.projectId ?? '');
    const enrollmentId = idHex(enrollment._id);
    const sequenceId = String(enrollment.sequenceId ?? '');
    const objectSlug = String(enrollment.objectSlug ?? '');
    const recordId = String(enrollment.recordId ?? '');
    const line: SequenceItemReport = {
        enrollmentId,
        sequenceId,
        projectId,
        status: 'ran',
    };
    const enrollments = db.collection(SEQ_ENROLLMENTS_COLL);
    const nowIso = new Date(now).toISOString();

    const stepIndex = Number(enrollment.currentStepIndex ?? 0);
    const steps = sequence.steps ?? [];

    /** Terminal-failure helper: mark the enrollment failed with a history line. */
    const failEnrollment = async (stepId: string | null, message: string) => {
        await enrollments.updateOne(
            { _id: enrollment._id as ObjectId },
            {
                $set: { status: 'failed', updatedAt: nowIso },
                $push: {
                    history: { stepId, at: nowIso, outcome: `failed: ${message}` },
                } as never,
            },
        );
        line.status = 'failed';
        line.detail = message;
    };

    // Past the last step (or an empty sequence) → complete.
    const step = steps[stepIndex];
    if (!step) {
        await enrollments.updateOne(
            { _id: enrollment._id as ObjectId },
            { $set: { status: 'completed', completedAt: nowIso, updatedAt: nowIso } },
        );
        line.status = 'ran';
        line.detail = 'completed';
        return line;
    }

    const stepId = String(step.id ?? `step_${stepIndex}`);
    const kind = String(step.kind ?? '').toLowerCase();
    let outcome: string;
    let nextRunAt = nowIso; // email/task: next step is eligible next tick.

    try {
        switch (kind) {
            case 'email': {
                const email = step.email ?? {};
                // Recipient comes off the record's data bag.
                const record = ObjectId.isValid(recordId)
                    ? ((await db
                          .collection(RECORDS_COLL)
                          .findOne({ _id: new ObjectId(recordId), projectId })) as {
                          data?: Record<string, unknown>;
                          deletedAt?: unknown;
                      } | null)
                    : null;
                if (!record || record.deletedAt) {
                    await failEnrollment(stepId, 'record missing or trashed');
                    return line;
                }
                const to = extractRecordEmail(record.data);
                if (!to) {
                    await failEnrollment(stepId, 'record has no email address');
                    return line;
                }
                // The project owner's transport sends the email.
                if (!ownerByProject.has(projectId)) {
                    ownerByProject.set(projectId, await resolveProjectOwner(db, projectId));
                }
                const ownerId = ownerByProject.get(projectId);
                if (!ownerId) {
                    await failEnrollment(stepId, 'project owner not found (no email transport)');
                    return line;
                }
                const rendered = await renderSequenceEmail(projectId, objectSlug, recordId, email);
                const sent = await dispatchTransactionalEmail({
                    tenantUserId: ownerId,
                    to,
                    subject: rendered.subject?.trim() || String(sequence.name ?? 'Sequence email'),
                    html: rendered.body ?? '',
                    templateId: email.templateId,
                });
                if (!sent.ok) {
                    await failEnrollment(stepId, `email send failed: ${sent.error ?? 'unknown'}`);
                    return line;
                }
                outcome = `email_sent (${to})`;
                break;
            }
            case 'task': {
                const task = step.task ?? {};
                let title = String(task.title ?? 'Sequence task');
                // Reuse the templates engine for `{{ }}` titles (cheap skip otherwise).
                if (title.includes('{{')) {
                    try {
                        const rendered = await renderSequenceEmail(
                            projectId,
                            objectSlug,
                            recordId,
                            { body: title },
                        );
                        if (rendered.body) title = rendered.body;
                    } catch {
                        // keep the literal title — interpolation is best-effort
                    }
                }
                const dueInDays = Number(task.dueInDays);
                await rustServiceFetch('/v1/sabcrm/activities', {
                    projectId,
                    method: 'POST',
                    body: JSON.stringify({
                        projectId,
                        type: 'TASK',
                        title,
                        body: `Sequence "${String(sequence.name ?? '')}" step ${stepIndex + 1}`,
                        targetObject: objectSlug || undefined,
                        targetRecordId: recordId || undefined,
                        authorId: String(enrollment.enrolledBy ?? 'system'),
                        status: 'TODO',
                        dueAt:
                            Number.isFinite(dueInDays) && dueInDays > 0
                                ? new Date(now + dueInDays * 24 * 60 * 60_000).toISOString()
                                : undefined,
                    }),
                });
                outcome = 'task_created';
                break;
            }
            case 'wait': {
                const days = Number(step.waitDays);
                const waitMs =
                    Number.isFinite(days) && days > 0 ? days * 24 * 60 * 60_000 : 0;
                nextRunAt = new Date(now + waitMs).toISOString();
                outcome = `waited (${Number.isFinite(days) ? days : 0}d)`;
                break;
            }
            default: {
                await failEnrollment(stepId, `unsupported step kind: ${step.kind}`);
                return line;
            }
        }
    } catch (e) {
        await failEnrollment(stepId, e instanceof Error ? e.message : 'step error');
        return line;
    }

    // Advance the state machine: next step, or complete after the last one.
    const nextIndex = stepIndex + 1;
    const finished = nextIndex >= steps.length;
    await enrollments.updateOne(
        { _id: enrollment._id as ObjectId },
        {
            $set: {
                currentStepIndex: nextIndex,
                status: finished ? 'completed' : 'active',
                nextRunAt,
                updatedAt: nowIso,
                ...(finished ? { completedAt: nowIso } : {}),
            },
            $push: { history: { stepId, at: nowIso, outcome } } as never,
        },
    );
    line.detail = finished ? `${outcome}; completed` : outcome;
    return line;
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
        timeElapsed: [],
        rotting: [],
        sequences: [],
        aiFields: [],
        scores: [],
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

    // --- 3. time.elapsed workflows (ported legacy-CRM `time_elapsed`) -------
    //
    // For each enabled `time.elapsed` workflow, scan its object's live records
    // and fire the workflow once per record whose anchor timestamp
    // (`sinceField`, default `updatedAt`) is older than the configured
    // threshold. Dedupe is durable: a `{ kind: 'time.elapsed', recordId }`
    // trigger is recorded on every run, and records that already have such a
    // run for this workflow are never fired again (legacy parity with the
    // dispatcher's dedupe-key guard, but permanent rather than hour-bucketed —
    // an idle record should be acted on once, not every hour).
    try {
        const candidates = (await db
            .collection(WORKFLOWS_COLL)
            .find({ enabled: true })
            .limit(500)
            .toArray()) as unknown as WorkflowDoc[];

        const timeWfs = candidates
            .filter(isTimeElapsedWorkflow)
            .slice(0, MAX_TIME_WORKFLOWS_PER_RUN);

        for (const wf of timeWfs) {
            const projectId = String(wf.projectId ?? '');
            const workflowId = idHex(wf._id);
            const object = String(wf.trigger?.object ?? '');
            const thresholdMs = timeElapsedThresholdMs(wf);
            if (!projectId || !object || thresholdMs <= 0) {
                report.timeElapsed.push({
                    workflowId,
                    projectId,
                    status: 'skipped',
                    detail:
                        'time.elapsed needs projectId, trigger.object and a positive afterMinutes/afterHours/afterDays',
                });
                continue;
            }
            const sinceField = timeElapsedSinceField(wf);

            // Records this workflow has already fired for (durable dedupe).
            const firedRows = (await db
                .collection(RUNS_COLL)
                .find({ workflowId, 'trigger.kind': 'time.elapsed' })
                .project({ 'trigger.recordId': 1 })
                .limit(5000)
                .toArray()) as unknown as Array<{ trigger?: { recordId?: string } }>;
            const fired = new Set(
                firedRows.map((r) => String(r.trigger?.recordId ?? '')).filter(Boolean),
            );

            const recs = (await db
                .collection(RECORDS_COLL)
                .find({ projectId, object, deletedAt: { $in: [null] } })
                .limit(MAX_RECORDS_PER_TIME_WORKFLOW)
                .toArray()) as unknown as RecordDoc[];

            let firedCount = 0;
            for (const rec of recs) {
                if (firedCount >= MAX_FIRES_PER_TIME_WORKFLOW) break;
                const recordId = idHex(rec._id);
                if (fired.has(recordId)) continue;
                const anchor = recordAnchorMs(rec, sinceField);
                if (anchor == null || now - anchor < thresholdMs) continue;

                const line = await executeWorkflow(
                    wf,
                    {
                        kind: 'time.elapsed',
                        recordId,
                        sinceField,
                        thresholdMinutes: Math.round(thresholdMs / 60_000),
                        firedAt: new Date(now).toISOString(),
                    },
                    recordId,
                );
                line.detail = line.detail ?? `record ${recordId}`;
                report.timeElapsed.push(line);
                if (line.status === 'ran') report.ran += 1;
                else if (line.status === 'failed') report.failed += 1;
                firedCount += 1;
            }
        }
    } catch (e) {
        report.timeElapsed.push({
            workflowId: '-',
            projectId: '-',
            status: 'failed',
            detail: `time.elapsed pass error: ${e instanceof Error ? e.message : String(e)}`,
        });
        report.failed += 1;
    }

    // --- 4. Deal rotting (pipeline stage `rottingDays` governance) ----------
    //
    // Pipelines are grouped by (projectId, object, stageField) with their
    // rotting thresholds merged, so overlapping pipelines can't undo each
    // other's tags within one tick. See `evaluateRottingGroup` for the
    // tag/untag mechanics (tag assignments, NOT a record field — a data write
    // would bump `updatedAt` and reset the idle clock being measured).
    try {
        const pipelines = (await db
            .collection(PIPELINES_COLL)
            .find({})
            .limit(500)
            .toArray()) as unknown as PipelineDoc[];

        interface RotGroup {
            projectId: string;
            object: string;
            stageField: string;
            pipelineIds: string[];
            rottingDaysByStage: Map<string, number>;
        }
        const groups = new Map<string, RotGroup>();
        for (const p of pipelines) {
            const projectId = String(p.projectId ?? '');
            if (!projectId) continue;
            const rottingStages = (p.stages ?? []).filter(
                (s) => Number(s?.rottingDays) > 0,
            );
            if (rottingStages.length === 0) continue;
            const object = String(p.object ?? 'opportunities');
            const stageField =
                typeof p.stageField === 'string' && p.stageField.trim()
                    ? p.stageField.trim()
                    : 'stage';
            const key = `${projectId} ${object} ${stageField}`;
            let group = groups.get(key);
            if (!group) {
                group = {
                    projectId,
                    object,
                    stageField,
                    pipelineIds: [],
                    rottingDaysByStage: new Map(),
                };
                groups.set(key, group);
            }
            group.pipelineIds.push(idHex(p._id));
            for (const s of rottingStages) {
                const stageId = String(s.id ?? '');
                const days = Number(s.rottingDays);
                if (!stageId || !Number.isFinite(days) || days <= 0) continue;
                // Keep the laxest threshold when pipelines disagree on a stage.
                const prev = group.rottingDaysByStage.get(stageId);
                group.rottingDaysByStage.set(
                    stageId,
                    prev === undefined ? days : Math.max(prev, days),
                );
            }
        }

        let processed = 0;
        for (const group of groups.values()) {
            if (processed >= MAX_ROTTING_PIPELINES_PER_RUN) break;
            processed += 1;
            try {
                const line = await evaluateRottingGroup(
                    db,
                    group.projectId,
                    group.object,
                    group.stageField,
                    group.pipelineIds,
                    group.rottingDaysByStage,
                    now,
                );
                report.rotting.push(line);
            } catch (e) {
                report.rotting.push({
                    pipelineId: group.pipelineIds.join(','),
                    projectId: group.projectId,
                    tagged: 0,
                    untagged: 0,
                    detail: `rotting pass error: ${e instanceof Error ? e.message : String(e)}`,
                });
            }
        }
    } catch (e) {
        report.rotting.push({
            pipelineId: '-',
            projectId: '-',
            tagged: 0,
            untagged: 0,
            detail: `rotting pass error: ${e instanceof Error ? e.message : String(e)}`,
        });
    }

    // --- 5. Sequence enrollments (crate `sabcrm-sequences`) -----------------
    //
    // Pop due enrollments (status active, nextRunAt <= now), cap per tick,
    // execute ONE step each (email / task / wait) and advance the state
    // machine. Each enrollment is CLAIMED first (its `nextRunAt` is pushed
    // `SEQUENCE_CLAIM_DELAY_MS` into the future with an optimistic
    // `nextRunAt` match) so a crashed tick retries later instead of
    // hot-looping, and an overlapping tick can't double-run the same step.
    try {
        const candidates = (await db
            .collection(SEQ_ENROLLMENTS_COLL)
            .find({ status: 'active' })
            .sort({ nextRunAt: 1 })
            .limit(500)
            .toArray()) as unknown as EnrollmentDoc[];

        const due = candidates
            .filter((e) => {
                const t = parseMs(e.nextRunAt);
                return t != null && t <= now;
            })
            .slice(0, MAX_SEQUENCE_ENROLLMENTS_PER_RUN);

        // Per-tick caches: sequence docs + project owner ids.
        const sequenceCache = new Map<string, SequenceDoc | null>();
        const ownerByProject = new Map<string, string | undefined>();

        for (const enrollment of due) {
            const enrollmentId = idHex(enrollment._id);
            const projectId = String(enrollment.projectId ?? '');
            const sequenceId = String(enrollment.sequenceId ?? '');
            if (!projectId || !sequenceId) {
                report.sequences.push({
                    enrollmentId,
                    sequenceId: sequenceId || '-',
                    projectId: projectId || '-',
                    status: 'skipped',
                    detail: 'enrollment missing projectId/sequenceId',
                });
                continue;
            }

            // Claim: push nextRunAt so neither a crash nor an overlapping
            // tick re-runs this step immediately. The optimistic nextRunAt
            // match makes the claim single-winner.
            const claim = await db.collection(SEQ_ENROLLMENTS_COLL).updateOne(
                {
                    _id: enrollment._id as ObjectId,
                    status: 'active',
                    nextRunAt: enrollment.nextRunAt,
                },
                {
                    $set: {
                        nextRunAt: new Date(now + SEQUENCE_CLAIM_DELAY_MS).toISOString(),
                    },
                },
            );
            if (claim.modifiedCount === 0) {
                report.sequences.push({
                    enrollmentId,
                    sequenceId,
                    projectId,
                    status: 'skipped',
                    detail: 'claimed by a concurrent tick (or no longer active)',
                });
                continue;
            }

            // Resolve the parent sequence (cached per tick).
            if (!sequenceCache.has(sequenceId)) {
                const seq = ObjectId.isValid(sequenceId)
                    ? ((await db
                          .collection(SEQUENCES_COLL)
                          .findOne({ _id: new ObjectId(sequenceId), projectId })) as
                          | SequenceDoc
                          | null)
                    : null;
                sequenceCache.set(sequenceId, seq);
            }
            const sequence = sequenceCache.get(sequenceId) ?? null;
            if (!sequence) {
                await db.collection(SEQ_ENROLLMENTS_COLL).updateOne(
                    { _id: enrollment._id as ObjectId },
                    {
                        $set: {
                            status: 'failed',
                            updatedAt: new Date(now).toISOString(),
                        },
                        $push: {
                            history: {
                                stepId: null,
                                at: new Date(now).toISOString(),
                                outcome: 'failed: sequence no longer exists',
                            },
                        } as never,
                    },
                );
                report.sequences.push({
                    enrollmentId,
                    sequenceId,
                    projectId,
                    status: 'failed',
                    detail: 'sequence no longer exists',
                });
                report.failed += 1;
                continue;
            }
            if (String(sequence.status ?? 'active') !== 'active') {
                // Paused sequence: leave the enrollment claimed (it re-checks
                // after the claim delay) without running or failing anything.
                report.sequences.push({
                    enrollmentId,
                    sequenceId,
                    projectId,
                    status: 'skipped',
                    detail: 'sequence is paused',
                });
                continue;
            }

            const line = await runEnrollmentStep(
                db,
                enrollment,
                sequence,
                ownerByProject,
                now,
            );
            report.sequences.push(line);
            if (line.status === 'ran') report.ran += 1;
            else if (line.status === 'failed') report.failed += 1;
        }
    } catch (e) {
        report.sequences.push({
            enrollmentId: '-',
            sequenceId: '-',
            projectId: '-',
            status: 'failed',
            detail: `sequences pass error: ${e instanceof Error ? e.message : String(e)}`,
        });
        report.failed += 1;
    }

    // --- 6. AI computed fields (FieldType 'AI', settings.ai) ----------------
    //
    // Discover objects carrying AI fields straight from `sabcrm_objects` (the
    // collection holds custom objects AND standard-object extension docs).
    // Per auto-refresh AI field, scan live records and recompute the ones
    // whose prompt inputs changed (sha256 dirty-hash). Each row is CLAIMED
    // single-winner — the claim writes the new hash + a `pending` meta up
    // front, so a crashed tick retries only after AI_FIELD_CLAIM_DELAY_MS.
    // The project owner's `ai_requests` quota gates every LLM call; usage is
    // metered with a deterministic idempotency key. Writes go DIRECT to Mongo
    // and never bump `updatedAt` (see ai-fields.server.ts).
    try {
        const objectDocs = (await db
            .collection(OBJECTS_COLL)
            .find({ 'fields.type': 'AI' })
            .limit(500)
            .toArray()) as unknown as Array<{
            projectId?: string;
            slug?: string;
            fields?: FieldMetadata[];
        }>;

        // Group by (projectId, slug): a standard object's extension doc and a
        // custom object's doc are shaped alike; merging keeps one scan per pair.
        interface AiGroup {
            projectId: string;
            slug: string;
            aiFields: FieldMetadata[];
            /** Every field key the docs declare (validates `{{token}}`s). */
            fieldKeys: Set<string>;
        }
        const aiGroups = new Map<string, AiGroup>();
        for (const doc of objectDocs) {
            const projectId = String(doc.projectId ?? '');
            const slug = String(doc.slug ?? '');
            if (!projectId || !slug) continue;
            const key = `${projectId} ${slug}`;
            let group = aiGroups.get(key);
            if (!group) {
                group = { projectId, slug, aiFields: [], fieldKeys: new Set() };
                aiGroups.set(key, group);
            }
            for (const f of doc.fields ?? []) {
                if (!f?.key) continue;
                group.fieldKeys.add(f.key);
                if (f.type === 'AI') group.aiFields.push(f);
            }
        }

        const ownerByProject = new Map<string, string | undefined>();
        const nowIso = new Date(now).toISOString();
        let scannedGroups = 0;
        let evals = 0;

        groupLoop: for (const group of aiGroups.values()) {
            if (scannedGroups >= MAX_AI_FIELD_OBJECTS_PER_RUN) break;
            if (group.aiFields.length === 0) continue;
            scannedGroups += 1;

            for (const field of group.aiFields) {
                const cfg = aiFieldConfig(field);
                if (!cfg || cfg.refresh !== 'auto') continue;

                const records = (await db
                    .collection(RECORDS_COLL)
                    .find({
                        projectId: group.projectId,
                        object: group.slug,
                        deletedAt: { $in: [null] },
                    })
                    .limit(MAX_RECORDS_PER_AI_FIELD)
                    .toArray()) as unknown as RecordDoc[];

                for (const rec of records) {
                    if (evals >= MAX_AI_FIELD_EVALS_PER_RUN) break groupLoop;
                    const recordId = idHex(rec._id);
                    const data = rec.data ?? {};

                    // Dirty check: hash the prompt + the raw values of its
                    // source fields. `{{token}}`s are validated against the
                    // doc's field keys UNION the record's own data keys (a
                    // standard object's built-in fields live only in the Rust
                    // merge, not in the extension doc — the data bag has them).
                    const keys = new Set<string>(group.fieldKeys);
                    for (const k of Object.keys(data)) {
                        if (k !== '__ai') keys.add(k);
                    }
                    const sources = aiSourceFields(cfg.prompt, keys);
                    const values: Record<string, unknown> = {};
                    for (const token of sources) {
                        values[token] =
                            token === 'updatedAt' || token === 'createdAt'
                                ? data[token] ?? rec[token as 'updatedAt' | 'createdAt']
                                : aiSourceValue(data, token);
                    }
                    const hash = aiInputsHash(cfg.prompt, values);

                    const aiMeta = (data.__ai ?? {}) as Record<
                        string,
                        | {
                              inputsHash?: string;
                              status?: string;
                              computedAt?: string;
                          }
                        | undefined
                    >;
                    const meta = aiMeta[field.key];

                    // Claim filter: single-winner via an optimistic match. For
                    // an unseen/changed hash the `$ne` guard wins; for a STALE
                    // `pending` row (crashed tick, same hash) the exact
                    // computedAt match wins — anything else is in sync
                    // (`ready`), failed-with-unchanged-inputs (no hot retry),
                    // or freshly claimed by another tick → skip silently.
                    let claimFilter: Record<string, unknown> | null = null;
                    if (meta?.inputsHash === hash) {
                        const stalePending =
                            meta.status === 'pending' &&
                            (parseMs(meta.computedAt) ?? 0) <=
                                now - AI_FIELD_CLAIM_DELAY_MS;
                        if (!stalePending) continue;
                        claimFilter = {
                            _id: rec._id as ObjectId,
                            [`data.__ai.${field.key}.status`]: 'pending',
                            [`data.__ai.${field.key}.computedAt`]: meta.computedAt,
                        };
                    } else {
                        claimFilter = {
                            _id: rec._id as ObjectId,
                            [`data.__ai.${field.key}.inputsHash`]: { $ne: hash },
                        };
                    }

                    const claim = await db.collection(RECORDS_COLL).updateOne(
                        claimFilter,
                        {
                            $set: {
                                [`data.__ai.${field.key}`]: {
                                    inputsHash: hash,
                                    status: 'pending',
                                    computedAt: nowIso,
                                    error: null,
                                },
                            },
                        },
                    );
                    if (claim.modifiedCount === 0) {
                        report.aiFields.push({
                            projectId: group.projectId,
                            objectSlug: group.slug,
                            fieldKey: field.key,
                            recordId,
                            status: 'skipped',
                            detail: 'claimed by a concurrent tick',
                        });
                        continue;
                    }

                    // Bill the project owner's ai_requests quota (the same
                    // tenant identity the sequences pass sends email as).
                    if (!ownerByProject.has(group.projectId)) {
                        ownerByProject.set(
                            group.projectId,
                            await resolveProjectOwner(db, group.projectId),
                        );
                    }
                    const ownerId = ownerByProject.get(group.projectId);
                    const allowed = ownerId
                        ? await canUse(ownerId, 'ai_requests')
                        : false;
                    if (!allowed) {
                        const error = ownerId
                            ? 'AI quota exceeded'
                            : 'project owner not found';
                        await db.collection(RECORDS_COLL).updateOne(
                            { _id: rec._id as ObjectId },
                            {
                                $set: {
                                    [`data.__ai.${field.key}`]: {
                                        inputsHash: hash,
                                        status: 'failed',
                                        computedAt: nowIso,
                                        error,
                                    },
                                },
                            },
                        );
                        report.aiFields.push({
                            projectId: group.projectId,
                            objectSlug: group.slug,
                            fieldKey: field.key,
                            recordId,
                            status: 'skipped',
                            detail: error,
                        });
                        continue;
                    }

                    evals += 1;
                    const result = await evaluateAiField({
                        db,
                        projectId: group.projectId,
                        objectSlug: group.slug,
                        field,
                        recordId,
                        inputsHash: hash,
                    });

                    if (result.status === 'ready') {
                        await recordUsage({
                            tenantId: ownerId as string,
                            feature: 'ai_requests',
                            units: 1,
                            idempotencyKey:
                                'sabcrm-ai-field:' +
                                recordId +
                                ':' +
                                field.key +
                                ':' +
                                hash,
                            meta: {
                                feature: 'sabcrm',
                                op: 'aiField',
                                object: group.slug,
                            },
                        });
                        report.aiFields.push({
                            projectId: group.projectId,
                            objectSlug: group.slug,
                            fieldKey: field.key,
                            recordId,
                            status: 'ran',
                        });
                        report.ran += 1;
                    } else if (result.status === 'failed') {
                        report.aiFields.push({
                            projectId: group.projectId,
                            objectSlug: group.slug,
                            fieldKey: field.key,
                            recordId,
                            status: 'failed',
                            detail: result.detail,
                        });
                        report.failed += 1;
                    } else {
                        report.aiFields.push({
                            projectId: group.projectId,
                            objectSlug: group.slug,
                            fieldKey: field.key,
                            recordId,
                            status: 'skipped',
                            detail: result.detail,
                        });
                    }
                }
            }
        }
    } catch (e) {
        report.aiFields.push({
            projectId: '-',
            objectSlug: '-',
            fieldKey: '-',
            recordId: '-',
            status: 'failed',
            detail: `ai-fields pass error: ${e instanceof Error ? e.message : String(e)}`,
        });
        report.failed += 1;
    }

    // --- 7. Rule-based scoring backstop -------------------------------------
    // Re-score records changed OUTSIDE the record actions (CSV import, public
    // API, the Rust write path); the per-mutation recompute in
    // sabcrm-twenty.actions.ts covers UI edits. Skips in-sync records via the
    // stored inputs hash. Best-effort — a failure must not fail the tick.
    try {
        const scoringProjects = await listProjectsWithScoring(db);
        for (const projectId of scoringProjects.slice(
            0,
            MAX_SCORING_PROJECTS_PER_RUN,
        )) {
            const sweeps = await recomputeAllProjectScores(
                projectId,
                MAX_SCORING_RECORDS_PER_OBJECT,
            );
            for (const s of sweeps) {
                if (s.scanned === 0 && s.updated === 0) continue;
                report.scores.push({ projectId, ...s });
                if (s.updated > 0) report.ran += 1;
            }
        }
    } catch {
        report.failed += 1;
    }

    // --- 8. Formula fields backstop ----------------------------------------
    // Recompute formula values for records changed out-of-band (CSV import /
    // public API / Rust-direct writes). Per-mutation recompute covers UI edits.
    try {
        const formulaProjects = await listProjectsWithFormulas(db);
        for (const projectId of formulaProjects.slice(0, MAX_SCORING_PROJECTS_PER_RUN)) {
            const sweeps = await recomputeAllProjectFormulas(
                projectId,
                MAX_SCORING_RECORDS_PER_OBJECT,
            );
            for (const s of sweeps) {
                if (s.scanned === 0 && s.updated === 0) continue;
                report.scores.push({ projectId, ...s });
                if (s.updated > 0) report.ran += 1;
            }
        }
    } catch {
        report.failed += 1;
    }

    // --- 9. Semantic embeddings backstop -----------------------------------
    // Re-embed records changed out-of-band, for OPTED-IN projects only
    // (listProjectsWithEmbeddings returns projects that already hold vectors).
    // Dirty-skip (textHash) makes steady state ~free; cold backlog converges
    // over ticks under the same caps as the scoring/formula sweeps.
    try {
        const embProjects = await listProjectsWithEmbeddings(db);
        for (const projectId of embProjects.slice(0, MAX_SCORING_PROJECTS_PER_RUN)) {
            const sweeps = await reindexAllProjectEmbeddings(
                projectId,
                MAX_SCORING_RECORDS_PER_OBJECT,
            );
            for (const s of sweeps) {
                if (s.scanned === 0 && s.updated === 0) continue;
                report.scores.push({ projectId, ...s });
                if (s.updated > 0) report.ran += 1;
            }
        }
    } catch {
        report.failed += 1;
    }

    report.durationMs = Date.now() - startedAt;
    const rotTagged = report.rotting.reduce((n, r) => n + r.tagged, 0);
    const rotUntagged = report.rotting.reduce((n, r) => n + r.untagged, 0);
    report.summary =
        `Fired ${report.scheduled.filter((s) => s.status === 'ran').length} scheduled workflow(s), ` +
        `retried ${report.retried.filter((r) => r.status === 'ran').length} failed run(s), ` +
        `fired ${report.timeElapsed.filter((t) => t.status === 'ran').length} time.elapsed run(s), ` +
        `rotting ${rotTagged} tagged / ${rotUntagged} untagged, ` +
        `sequences ${report.sequences.filter((s) => s.status === 'ran').length} step(s), ` +
        `AI fields ${report.aiFields.filter((a) => a.status === 'ran').length} computed; ` +
        `scoring ${report.scores.reduce((n, s) => n + s.updated, 0)} re-scored; ` +
        `${report.ran} ran, ${report.failed} failed` +
        (report.engineReachable ? '' : ' (engine appears unreachable — check RUST_API_URL)');
    return report;
}
