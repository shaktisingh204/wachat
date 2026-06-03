import 'server-only';

/**
 * SabCRM stored-engine runtime — makes the persisted audit / notification /
 * workflow engines actually FIRE, inline in the record server actions, with no
 * separate worker process.
 *
 * The record mutation actions in
 * `src/app/actions/sabcrm-twenty.actions.ts` call these helpers after a
 * successful create / update / delete. Every function here is **best-effort**:
 * each engine call is wrapped in try/catch and NEVER throws. The Rust engine
 * may be offline at dev time, and a failure here must never break the primary
 * record mutation — the side-effects are fire-and-forget (awaited so they
 * complete within the request, but swallowed on error).
 *
 * Engines touched (all server-only Rust clients, called directly):
 * - {@link sabcrmAuditApi}        — append change-log entries
 * - {@link sabcrmNotificationsApi}— per-user in-app notifications
 * - {@link sabcrmWorkflowsApi}    — per-project automation rules
 * - {@link sabcrmActivitiesApi}   — timeline tasks (workflow `create_task`)
 * - {@link sabcrmRecordsApi}      — record read/write (CRUD + query actions)
 *
 * ## Workflow executor (this file)
 *
 * The executor is a small, synchronous, single-pass step runner. Beyond the
 * original four side-effect actions (`create_task`, `send_notification`,
 * `update_field`, `webhook`) it now supports a `{{variable}}` interpolation
 * engine, control-flow actions (`FILTER` / `IF_ELSE`), and record-query
 * actions (`FIND_RECORDS` / `UPSERT_RECORD`). A **running context** threads
 * the trigger payload and each step's output through later steps, and every
 * execution is recorded as a durable {@link WorkflowRun} (best-effort).
 *
 * ### `{{ }}` variable syntax
 *
 * String values in a step's `config` are resolved through {@link resolveVars}
 * before the step runs. Three token namespaces are understood, each a
 * dotted path into the running {@link WorkflowContext}:
 *
 * - `{{trigger.<key>}}` — a field of the trigger payload (the mutated record's
 *   `data`, e.g. `{{trigger.email}}`).
 * - `{{record.<key>}}`  — an alias of the trigger record (`{{record.id}}` and
 *   the mutated `data.*`), kept distinct so authors can read record identity.
 * - `{{steps.<stepId>.<key>}}` — a field of an earlier step's output (e.g.
 *   `{{steps.find1.count}}` or `{{steps.find1.records}}`).
 *
 * Resolution rules mirror Twenty's `resolveInput`: a string that is **exactly
 * one** token (`"{{steps.find1.records}}"`) resolves to the referenced value
 * with its native type preserved (array / object / number / boolean). A string
 * with surrounding text or multiple tokens is string-interpolated (missing or
 * non-scalar values render as `""`). Unknown tokens render empty.
 */
import { sabcrmAuditApi } from '@/lib/rust-client/sabcrm-audit';
import { sabcrmNotificationsApi } from '@/lib/rust-client/sabcrm-notifications';
import {
  sabcrmWorkflowsApi,
  type SabcrmRustWorkflow,
  type SabcrmWorkflowEvent,
  type SabcrmWorkflowStep,
} from '@/lib/rust-client/sabcrm-workflows';
import { sabcrmActivitiesApi } from '@/lib/rust-client/sabcrm-activities';
import {
  sabcrmRecordsApi,
  type SabcrmRecordFilters,
} from '@/lib/rust-client/sabcrm-records';
import { rustFetch } from '@/lib/rust-client/fetcher';

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

/** Args for {@link recordAudit}. */
export interface RecordAuditArgs {
  /** Acting user id (informational; the Rust side resolves the real actor). */
  actorId?: string;
  /** Change verb, e.g. `create` | `update` | `delete`. */
  action: string;
  /** Object slug the change targets. */
  object: string;
  /** Record id the change targets. */
  recordId: string;
  /** Optional human summary. */
  summary?: string;
}

/**
 * Append an audit entry for a record change. Best-effort — swallows any error
 * (a downed engine must not break the mutation).
 */
export async function recordAudit(
  projectId: string,
  args: RecordAuditArgs,
): Promise<void> {
  try {
    await sabcrmAuditApi.log(projectId, {
      action: args.action,
      object: args.object,
      recordId: args.recordId,
      summary: args.summary,
      meta: args.actorId ? { actorId: args.actorId } : undefined,
    });
  } catch {
    // best-effort: never throw
  }
}

// ---------------------------------------------------------------------------
// Assignment notification
// ---------------------------------------------------------------------------

/**
 * Pull an assignee user-id out of a record's `data` bag, if present. Accepts
 * either `assigneeId` or `assignee` (string, or `{ id }` object).
 */
function extractAssignee(data: Record<string, unknown>): string | undefined {
  if (!data) return undefined;
  const raw = data.assigneeId ?? data.assignee;
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  if (raw && typeof raw === 'object') {
    const id = (raw as { id?: unknown }).id;
    if (typeof id === 'string' && id.trim()) return id.trim();
  }
  return undefined;
}

/**
 * If `data` carries an assignee (`assigneeId` / `assignee`), notify that user
 * they were assigned the record. Best-effort — no-op when no assignee is set,
 * swallows any error.
 */
export async function maybeNotifyAssignment(
  projectId: string,
  object: string,
  recordId: string,
  data: Record<string, unknown>,
  actorId?: string,
): Promise<void> {
  try {
    const assignee = extractAssignee(data ?? {});
    if (!assignee) return;
    await sabcrmNotificationsApi.create(projectId, {
      userId: assignee,
      kind: 'assignment',
      title: 'You were assigned a record',
      body: actorId ? `Assigned by ${actorId}.` : undefined,
      targetObject: object,
      targetRecordId: recordId,
    });
  } catch {
    // best-effort: never throw
  }
}

// ---------------------------------------------------------------------------
// Variable engine — {{trigger.*}} / {{record.*}} / {{steps.<id>.*}}
// ---------------------------------------------------------------------------

/**
 * The running context threaded through a workflow execution. `trigger` is the
 * mutated record's `data` payload, `record` aliases the same payload plus the
 * record `id`, and `steps` accumulates each completed step's output keyed by
 * step id, so later steps can reference earlier results.
 */
export interface WorkflowContext {
  /** The trigger payload — the mutated record's `data` bag. */
  trigger: Record<string, unknown>;
  /** Alias of the trigger record (`id` + the mutated `data.*`). */
  record: Record<string, unknown>;
  /** Per-step outputs, keyed by step id. */
  steps: Record<string, Record<string, unknown>>;
}

/** Matches `{{ ... }}` tokens (no nested braces), mirroring Twenty. */
const TOKEN_RE = /\{\{([^{}]+)\}\}/g;
/** A string that is *exactly* one token (whitespace-tolerant). */
const SINGLE_TOKEN_RE = /^\s*\{\{([^{}]+)\}\}\s*$/;

/** Walk a dotted path (`a.b.c`) into a value, returning `undefined` if absent. */
function getPath(root: unknown, path: string): unknown {
  const parts = path.split('.').map((p) => p.trim()).filter(Boolean);
  let cur: unknown = root;
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

/**
 * Resolve a single `{{...}}` token's dotted path against the context. Supported
 * roots are `trigger`, `record`, and `steps`; anything else is `undefined`.
 */
function evalToken(token: string, ctx: WorkflowContext): unknown {
  const path = token.trim();
  if (path === 'trigger' || path.startsWith('trigger.')) {
    return path === 'trigger' ? ctx.trigger : getPath(ctx.trigger, path.slice('trigger.'.length));
  }
  if (path === 'record' || path.startsWith('record.')) {
    return path === 'record' ? ctx.record : getPath(ctx.record, path.slice('record.'.length));
  }
  if (path === 'steps' || path.startsWith('steps.')) {
    return path === 'steps' ? ctx.steps : getPath(ctx.steps, path.slice('steps.'.length));
  }
  return undefined;
}

/** Render a resolved value as a string for interpolation (objects → JSON). */
function stringifyForInterp(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

/**
 * Substitute `{{trigger.<key>}}`, `{{record.<key>}}` and `{{steps.<id>.<key>}}`
 * tokens in `template` against `ctx`.
 *
 * - A string that is exactly one token resolves to the referenced value with
 *   its **native type preserved** (so `"{{steps.find.records}}"` yields the
 *   array, not its JSON text).
 * - Otherwise tokens are string-interpolated into the surrounding text.
 *
 * Non-string inputs are returned unchanged (this is a string resolver).
 */
export function resolveVars(template: unknown, ctx: WorkflowContext): unknown {
  if (typeof template !== 'string') return template;
  const single = template.match(SINGLE_TOKEN_RE);
  if (single) {
    // Whole-string token → preserve the native type of the resolved value.
    return evalToken(single[1], ctx);
  }
  return template.replace(TOKEN_RE, (_m, token: string) =>
    stringifyForInterp(evalToken(token, ctx)),
  );
}

/**
 * Resolve every string value (recursively, keys left intact) in a step's
 * `config` object through {@link resolveVars}, returning a new resolved object.
 * Arrays and nested objects are walked; non-string leaves pass through.
 */
function resolveConfig(
  config: Record<string, unknown>,
  ctx: WorkflowContext,
): Record<string, unknown> {
  const walk = (val: unknown): unknown => {
    if (typeof val === 'string') return resolveVars(val, ctx);
    if (Array.isArray(val)) return val.map(walk);
    if (val && typeof val === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
        out[k] = walk(v);
      }
      return out;
    }
    return val;
  };
  return walk(config ?? {}) as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Condition evaluation (FILTER / IF_ELSE)
// ---------------------------------------------------------------------------

/** A simple condition evaluated against the running context. */
interface StepCondition {
  /** Dotted path read from the context (e.g. `trigger.stage`). */
  field: string;
  operator: string;
  value?: unknown;
}

/** Coerce a value to a number, or `NaN` if it can't be one. */
function toNum(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim() !== '') return Number(v);
  return NaN;
}

/**
 * Evaluate one `{ field, operator, value }` condition against `ctx`. The
 * `field` is a dotted context path (any of the `trigger` / `record` / `steps`
 * roots, falling back to a bare `trigger.*` lookup). Unknown operators are
 * treated as a non-match (`false`).
 */
function evalCondition(cond: StepCondition | undefined, ctx: WorkflowContext): boolean {
  if (!cond || !cond.field) return true;
  // Allow bare field names (no root) to read off the trigger payload.
  const path = cond.field;
  const left =
    path.startsWith('trigger') || path.startsWith('record') || path.startsWith('steps')
      ? evalToken(path, ctx)
      : getPath(ctx.trigger, path);
  const right = cond.value;
  switch (cond.operator) {
    case 'eq':
    case '==':
    case 'equals':
      return left === right || String(left ?? '') === String(right ?? '');
    case 'ne':
    case '!=':
    case 'notEquals':
      return !(left === right || String(left ?? '') === String(right ?? ''));
    case 'contains':
      return String(left ?? '').includes(String(right ?? ''));
    case 'notContains':
      return !String(left ?? '').includes(String(right ?? ''));
    case 'gt':
      return toNum(left) > toNum(right);
    case 'gte':
      return toNum(left) >= toNum(right);
    case 'lt':
      return toNum(left) < toNum(right);
    case 'lte':
      return toNum(left) <= toNum(right);
    case 'isEmpty':
      return left == null || left === '' || (Array.isArray(left) && left.length === 0);
    case 'isNotEmpty':
      return !(left == null || left === '' || (Array.isArray(left) && left.length === 0));
    case 'truthy':
      return Boolean(left);
    case 'falsy':
      return !left;
    default:
      return false;
  }
}

/** Read a `{ field, operator, value }` condition off a resolved config. */
function readCondition(config: Record<string, unknown>): StepCondition | undefined {
  const field = config.field;
  if (typeof field !== 'string' || !field) return undefined;
  return {
    field,
    operator: typeof config.operator === 'string' ? config.operator : 'eq',
    value: config.value,
  };
}

// ---------------------------------------------------------------------------
// Workflow execution
// ---------------------------------------------------------------------------

/** Counts returned by a workflow run (callers ignore failures). */
export interface WorkflowRunSummary {
  /** Number of enabled workflows that matched + ran. */
  workflowsRun: number;
  /** Number of steps that executed across all matched workflows. */
  stepsRun: number;
  /** Number of steps that failed (swallowed). */
  stepsFailed: number;
}

/** The recorded outcome of one step, persisted into a {@link WorkflowRun}. */
export interface RecordedStep {
  id: string;
  type: string;
  /** `success` | `failed` | `skipped`. */
  status: 'success' | 'failed' | 'skipped';
  /** Structured output this step contributed to the context (if any). */
  output?: Record<string, unknown>;
  /** Failure detail (best-effort message). */
  error?: string;
}

/** Read a string off a resolved step `config`, `undefined` if absent. */
function cfgStr(
  config: Record<string, unknown>,
  key: string,
): string | undefined {
  const v = config?.[key];
  if (typeof v === 'string' && v.length > 0) return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return undefined;
}

/** Outcome of running a single step. */
interface StepOutcome {
  status: 'success' | 'failed' | 'skipped';
  /** Output merged into `ctx.steps[step.id]`. */
  output?: Record<string, unknown>;
  /** Failure detail (best-effort message), set when `status === 'failed'`. */
  error?: string;
  /**
   * When `true`, a FILTER/IF_ELSE gate evaluated false — the remaining steps
   * of this workflow should be SKIPPED (not executed).
   */
  gateClosed?: boolean;
}

/**
 * Execute one workflow step's action. The step's `config` has already been
 * resolved through the `{{ }}` engine. Best-effort — each branch is guarded so
 * one bad step never aborts the rest; returns a structured {@link StepOutcome}.
 */
async function runStep(
  projectId: string,
  step: SabcrmWorkflowStep,
  config: Record<string, unknown>,
  object: string,
  recordId: string,
  actorId?: string,
): Promise<StepOutcome> {
  try {
    switch (step.type) {
      case 'create_task': {
        await sabcrmActivitiesApi.create({
          projectId,
          type: 'TASK',
          title: cfgStr(config, 'title') ?? 'Workflow task',
          body: cfgStr(config, 'body') ?? '',
          targetObject: object,
          targetRecordId: recordId,
          authorId: actorId ?? '',
          status: 'TODO',
        });
        return { status: 'success' };
      }
      case 'send_notification': {
        await sabcrmNotificationsApi.create(projectId, {
          userId: cfgStr(config, 'userId') ?? actorId,
          kind: 'system',
          title: cfgStr(config, 'title') ?? 'Workflow notification',
          body: cfgStr(config, 'body'),
          targetObject: object,
          targetRecordId: recordId,
        });
        return { status: 'success' };
      }
      case 'update_field': {
        const field = cfgStr(config, 'field');
        if (!field) return { status: 'failed', error: 'update_field: missing field' };
        await sabcrmRecordsApi.update(object, recordId, {
          projectId,
          data: { [field]: config.value },
        });
        return { status: 'success', output: { field, value: config.value } };
      }
      case 'webhook': {
        const url = cfgStr(config, 'url');
        if (!url) return { status: 'failed', error: 'webhook: missing url' };
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            projectId,
            object,
            recordId,
            actorId,
            step: step.id,
            // forward any author-supplied payload (already var-resolved)
            payload: config.payload ?? config.body ?? undefined,
          }),
        });
        return { status: 'success', output: { status: res.status } };
      }

      // --- record queries --------------------------------------------------
      // (FILTER / IF_ELSE are evaluated upstream in runResolvedStep, which has
      //  the running context; they never reach this dispatch.)
      case 'find_records':
      case 'FIND_RECORDS': {
        const target = cfgStr(config, 'object') ?? object;
        const filters = (config.filter ?? config.filters) as
          | SabcrmRecordFilters
          | undefined;
        const limit = Number(config.limit);
        const res = await sabcrmRecordsApi.list(target, {
          projectId,
          filters:
            filters && typeof filters === 'object' ? filters : undefined,
          q: cfgStr(config, 'q'),
          limit: Number.isFinite(limit) && limit > 0 ? limit : undefined,
        });
        return {
          status: 'success',
          output: {
            records: res.records,
            count: res.total,
            firstId: res.records[0]?.id,
          },
        };
      }
      case 'upsert_record':
      case 'UPSERT_RECORD': {
        const target = cfgStr(config, 'object') ?? object;
        const data =
          config.data && typeof config.data === 'object'
            ? (config.data as Record<string, unknown>)
            : {};
        // Update when an id is supplied (or a match is found), else create.
        const explicitId = cfgStr(config, 'recordId') ?? cfgStr(config, 'id');
        let matchedId = explicitId;
        const matchField = cfgStr(config, 'matchField');
        if (!matchedId && matchField) {
          const matchValue = (config.matchValue ?? data[matchField]) as unknown;
          if (matchValue !== undefined && matchValue !== null && matchValue !== '') {
            const found = await sabcrmRecordsApi.list(target, {
              projectId,
              filters: { [matchField]: matchValue },
              limit: 1,
            });
            matchedId = found.records[0]?.id;
          }
        }
        if (matchedId) {
          const updated = await sabcrmRecordsApi.update(target, matchedId, {
            projectId,
            data,
          });
          return {
            status: 'success',
            output: { id: updated.id, created: false, data: updated.data },
          };
        }
        const created = await sabcrmRecordsApi.create(target, {
          projectId,
          data,
          createdBy: actorId,
        });
        return {
          status: 'success',
          output: { id: created.id, created: true, data: created.data },
        };
      }

      default:
        return { status: 'failed', error: `unknown step type: ${step.type}` };
    }
  } catch (err) {
    return {
      status: 'failed',
      error: err instanceof Error ? err.message : 'step error',
    };
  }
}

/**
 * Resolve a step's config against `ctx`, evaluate gate steps
 * (`FILTER` / `IF_ELSE`) here (they need the full context), and dispatch
 * everything else to {@link runStep}. Never throws.
 */
async function runResolvedStep(
  projectId: string,
  step: SabcrmWorkflowStep,
  ctx: WorkflowContext,
  object: string,
  recordId: string,
  actorId?: string,
): Promise<StepOutcome> {
  const config = resolveConfig(step.config ?? {}, ctx);
  const type = String(step.type).toLowerCase();

  // Gate actions are evaluated inline because they read the running context.
  if (type === 'filter') {
    const pass = evalCondition(readCondition(config), ctx);
    return pass
      ? { status: 'success', output: { passed: true } }
      : { status: 'skipped', output: { passed: false }, gateClosed: true };
  }
  if (type === 'if_else' || type === 'ifelse') {
    const pass = evalCondition(readCondition(config), ctx);
    // Branch by skipping the rest when the condition is false (the "else" of a
    // linear pipeline is "stop"). The taken branch simply continues.
    return pass
      ? { status: 'success', output: { branch: 'then', passed: true } }
      : { status: 'skipped', output: { branch: 'else', passed: false }, gateClosed: true };
  }

  return runStep(projectId, step, config, object, recordId, actorId);
}

/**
 * Run every step of one workflow in order, threading a running `ctx`. A FILTER /
 * IF_ELSE step that evaluates false closes the gate: every subsequent step is
 * stamped `skipped` and not executed. Best-effort throughout. Returns the
 * per-step recording plus run/fail counts.
 */
async function runWorkflowSteps(
  projectId: string,
  workflow: SabcrmRustWorkflow,
  ctx: WorkflowContext,
  object: string,
  recordId: string,
  actorId?: string,
): Promise<{ stepsRun: number; stepsFailed: number; recorded: RecordedStep[] }> {
  let stepsRun = 0;
  let stepsFailed = 0;
  let gateClosed = false;
  const recorded: RecordedStep[] = [];

  for (const step of workflow.steps ?? []) {
    if (gateClosed) {
      recorded.push({ id: step.id, type: step.type, status: 'skipped' });
      continue;
    }
    const outcome = await runResolvedStep(
      projectId,
      step,
      ctx,
      object,
      recordId,
      actorId,
    );
    if (outcome.output) {
      // Make this step's output referenceable by later steps via {{steps.id.*}}
      ctx.steps[step.id] = outcome.output;
    }
    recorded.push({
      id: step.id,
      type: step.type,
      status: outcome.status,
      output: outcome.output,
      error: outcome.error,
    });
    if (outcome.status === 'success') stepsRun += 1;
    else if (outcome.status === 'failed') stepsFailed += 1;
    if (outcome.gateClosed) gateClosed = true;
  }

  return { stepsRun, stepsFailed, recorded };
}

/** Build a fresh execution context from the trigger payload + record id. */
function buildContext(
  recordId: string,
  data: Record<string, unknown>,
): WorkflowContext {
  const trigger = data ?? {};
  return {
    trigger,
    record: { id: recordId, ...trigger },
    steps: {},
  };
}

// ---------------------------------------------------------------------------
// Durable run recording (best-effort)
// ---------------------------------------------------------------------------

/** Input to {@link createWorkflowRunTw}. */
interface CreateWorkflowRunInput {
  workflowId: string;
  trigger: unknown;
  status: 'running' | 'completed' | 'failed';
  steps: RecordedStep[];
}

/** Patch to {@link updateWorkflowRunTw}. */
interface UpdateWorkflowRunInput {
  status?: 'running' | 'completed' | 'failed';
  steps?: RecordedStep[];
  finishedAt?: string;
}

const RUNS_BASE = '/v1/sabcrm/workflow-runs';

/**
 * Open a durable run record at the start of an execution. Best-effort: returns
 * the new run id, or `undefined` if the runs surface is unavailable (a downed
 * engine must never break the mutation that triggered the workflow).
 *
 * Mirrors the parallel `sabcrmWorkflowRunsApi.create`; called directly through
 * {@link rustFetch} so this file carries no compile-time dependency on a client
 * module owned by a sibling change.
 */
async function createWorkflowRunTw(
  projectId: string,
  input: CreateWorkflowRunInput,
): Promise<string | undefined> {
  try {
    const res = await rustFetch<{ run?: { id?: string }; id?: string }>(
      RUNS_BASE,
      { method: 'POST', body: JSON.stringify({ projectId, ...input }) },
    );
    return res?.run?.id ?? res?.id;
  } catch {
    return undefined;
  }
}

/**
 * Finalize a durable run record. Best-effort — no-op when `runId` is undefined
 * (the open failed) and swallows any error.
 */
async function updateWorkflowRunTw(
  projectId: string,
  runId: string | undefined,
  patch: UpdateWorkflowRunInput,
): Promise<void> {
  if (!runId) return;
  try {
    await rustFetch(`${RUNS_BASE}/${encodeURIComponent(runId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ projectId, ...patch }),
    });
  } catch {
    // best-effort: never throw
  }
}

/**
 * Run one workflow end-to-end with durable run recording wrapped around it:
 * open a `running` run, execute the steps, then finalize the run with the
 * terminal status + per-step record. The recording is entirely best-effort and
 * never affects the returned counts.
 */
async function runWorkflowWithRecording(
  projectId: string,
  workflow: SabcrmRustWorkflow,
  ctx: WorkflowContext,
  object: string,
  recordId: string,
  actorId?: string,
): Promise<{ stepsRun: number; stepsFailed: number }> {
  const runId = await createWorkflowRunTw(projectId, {
    workflowId: workflow.id,
    trigger: ctx.trigger,
    status: 'running',
    steps: [],
  });

  const { stepsRun, stepsFailed, recorded } = await runWorkflowSteps(
    projectId,
    workflow,
    ctx,
    object,
    recordId,
    actorId,
  );

  await updateWorkflowRunTw(projectId, runId, {
    status: stepsFailed > 0 ? 'failed' : 'completed',
    steps: recorded,
    finishedAt: new Date().toISOString(),
  });

  return { stepsRun, stepsFailed };
}

/**
 * Load the project's workflows, filter to the enabled ones whose trigger
 * matches `(event, object)`, and execute each one's steps once — resolving
 * `{{ }}` variables against a per-workflow context seeded from `data`, and
 * recording a durable run per workflow. Best-effort — a downed engine yields a
 * zeroed summary instead of throwing.
 */
export async function runWorkflowsForEvent(
  projectId: string,
  event: SabcrmWorkflowEvent,
  object: string,
  recordId: string,
  data: Record<string, unknown>,
  actorId?: string,
): Promise<WorkflowRunSummary> {
  const summary: WorkflowRunSummary = {
    workflowsRun: 0,
    stepsRun: 0,
    stepsFailed: 0,
  };
  try {
    const workflows = await sabcrmWorkflowsApi.list(projectId);
    const matched = workflows.filter(
      (w) =>
        w.enabled &&
        w.trigger?.event === event &&
        w.trigger?.object === object,
    );
    for (const wf of matched) {
      // Each workflow gets a fresh context (independent step namespaces).
      const ctx = buildContext(recordId, data ?? {});
      const { stepsRun, stepsFailed } = await runWorkflowWithRecording(
        projectId,
        wf,
        ctx,
        object,
        recordId,
        actorId,
      );
      summary.workflowsRun += 1;
      summary.stepsRun += stepsRun;
      summary.stepsFailed += stepsFailed;
    }
  } catch {
    // best-effort: never throw
  }
  return summary;
}

/**
 * Manually run a single workflow by id (an explicit "run now"), independent of
 * any record event. The workflow's own `trigger.object` is used as the step
 * target object unless `object` is supplied; `recordId` may be empty for
 * record-less steps. Variables resolve against an (empty-ish) context seeded
 * from the supplied `recordId`. A durable run is recorded. Best-effort —
 * returns a `ran: false` summary on failure rather than throwing.
 */
export async function executeWorkflowById(
  projectId: string,
  workflowId: string,
  object?: string,
  recordId?: string,
  actorId?: string,
): Promise<{ ran: boolean; summary?: WorkflowRunSummary }> {
  try {
    const workflow = await sabcrmWorkflowsApi.get(projectId, workflowId);
    if (!workflow) return { ran: false };
    const targetObject = object ?? workflow.trigger?.object ?? '';
    const ctx = buildContext(recordId ?? '', {});
    const { stepsRun, stepsFailed } = await runWorkflowWithRecording(
      projectId,
      workflow,
      ctx,
      targetObject,
      recordId ?? '',
      actorId,
    );
    return {
      ran: true,
      summary: { workflowsRun: 1, stepsRun, stepsFailed },
    };
  } catch {
    // best-effort: never throw
    return { ran: false };
  }
}
