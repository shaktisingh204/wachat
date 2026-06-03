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
 * - {@link sabcrmRecordsApi}      — record updates (workflow `update_field`)
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
import { sabcrmRecordsApi } from '@/lib/rust-client/sabcrm-records';

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

/** Read a string off a step `config`, returning `undefined` if absent. */
function cfgStr(
  config: Record<string, unknown>,
  key: string,
): string | undefined {
  const v = config?.[key];
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

/**
 * Execute one workflow step's action against a record. Best-effort — each
 * branch is individually guarded so one bad step never aborts the rest.
 * Returns `true` on success, `false` on a (swallowed) failure.
 */
async function runStep(
  projectId: string,
  step: SabcrmWorkflowStep,
  object: string,
  recordId: string,
  actorId?: string,
): Promise<boolean> {
  const config = step.config ?? {};
  try {
    switch (step.type) {
      case 'create_task': {
        await sabcrmActivitiesApi.create({
          projectId,
          type: 'TASK',
          title: cfgStr(config, 'title') ?? 'Workflow task',
          body: '',
          targetObject: object,
          targetRecordId: recordId,
          authorId: actorId ?? '',
          status: 'TODO',
        });
        return true;
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
        return true;
      }
      case 'update_field': {
        const field = cfgStr(config, 'field');
        if (!field) return false;
        await sabcrmRecordsApi.update(object, recordId, {
          projectId,
          data: { [field]: config.value },
        });
        return true;
      }
      case 'webhook': {
        const url = cfgStr(config, 'url');
        if (!url) return false;
        await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            projectId,
            object,
            recordId,
            actorId,
            step: step.id,
          }),
        });
        return true;
      }
      default:
        return false;
    }
  } catch {
    // best-effort: never throw
    return false;
  }
}

/** Run every step of one workflow in order. Best-effort. */
async function runWorkflowSteps(
  projectId: string,
  workflow: SabcrmRustWorkflow,
  object: string,
  recordId: string,
  actorId?: string,
): Promise<{ stepsRun: number; stepsFailed: number }> {
  let stepsRun = 0;
  let stepsFailed = 0;
  for (const step of workflow.steps ?? []) {
    const ok = await runStep(projectId, step, object, recordId, actorId);
    if (ok) stepsRun += 1;
    else stepsFailed += 1;
  }
  return { stepsRun, stepsFailed };
}

/**
 * Load the project's workflows, filter to the enabled ones whose trigger
 * matches `(event, object)`, and execute each one's steps once. Best-effort —
 * a downed engine yields a zeroed summary instead of throwing.
 */
export async function runWorkflowsForEvent(
  projectId: string,
  event: SabcrmWorkflowEvent,
  object: string,
  recordId: string,
  _data: Record<string, unknown>,
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
      const { stepsRun, stepsFailed } = await runWorkflowSteps(
        projectId,
        wf,
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
 * record-less steps. Best-effort — returns a `ran: false` summary on failure
 * rather than throwing.
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
    const { stepsRun, stepsFailed } = await runWorkflowSteps(
      projectId,
      workflow,
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
