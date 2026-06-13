import 'server-only';

/**
 * SabCRM → SabFlow event dispatch (server-only).
 *
 * Fans a CRM record event out to the SabFlow engine so automations get true
 * branching / parallel / delay / approval — riding the SAME pipeline the
 * Slack / Telegram / SabWa receivers use (`@/lib/sabflow/triggers/receiver`):
 * find matching rows in `sabflow_triggers` (source `'sabcrm'`) → write a
 * `sabflow_executions` row → enqueue an execute job on `SABFLOW_QUEUE` (the
 * standalone `sabflow-worker` consumes it).
 *
 * This is ADDITIVE to SabCRM's own linear `sabcrm_workflows` engine — both fire
 * for the same event (simple rules stay linear; SabFlow handles the rest).
 *
 * Best-effort: it only ENQUEUES (never writes the record, so it never bumps
 * `updatedAt`) and never throws — a downed Redis/Mongo must not break the record
 * mutation that triggered it. Until a project creates a CRM→flow binding (see
 * `./flow-bindings.server.ts`) there are no matching trigger rows and this is a
 * clean no-op.
 */

import {
  enqueueTriggerJobs,
  fingerprintPayload,
  claimFingerprint,
} from '@/lib/sabflow/triggers/receiver';
import type { SabcrmWorkflowEvent } from '@/lib/rust-client/sabcrm-workflows';

/** The `sabflow_triggers.appEvent` slug for a CRM event, e.g. `sabcrm.record.created`. */
export function sabcrmAppEvent(event: SabcrmWorkflowEvent): string {
  return `sabcrm.${event}`;
}

/**
 * Dispatch one CRM record event to every SabFlow flow bound to it. The flow's
 * trigger input is `{ trigger: {...}, ...flattened }` so downstream nodes /
 * `EventFilter` dot-paths can read `trigger.record.<field>`.
 *
 * Object scoping rides `findMatchingTriggers`' externalId wildcard: a binding
 * row with `externalId: '<object>'` fires only for that object; a row without
 * `externalId` is an any-object binding.
 */
export async function dispatchSabflowForEvent(
  projectId: string,
  event: SabcrmWorkflowEvent,
  object: string,
  recordId: string,
  data: Record<string, unknown>,
  actorId?: string,
): Promise<void> {
  try {
    if (!projectId || !object || !recordId) return;
    const appEvent = sabcrmAppEvent(event);
    const payload: Record<string, unknown> = {
      trigger: { object, event, recordId, record: data, actorId, projectId },
      object,
      event,
      recordId,
      record: data,
      actorId,
      receivedAt: new Date().toISOString(),
    };
    // Dedup identical re-fires within the 5-min window, but keep recordId+event
    // in the key so legitimate repeat edits to the SAME record still fire.
    const fingerprint = fingerprintPayload('sabcrm', {
      projectId,
      object,
      event,
      recordId,
      at: payload.receivedAt,
    });
    const fresh = await claimFingerprint(fingerprint);
    if (!fresh) return;
    await enqueueTriggerJobs({
      source: 'sabcrm',
      hint: { externalId: object, appEvent },
      payload,
      fingerprint,
    });
  } catch {
    // best-effort: never throw out of a record-mutation side effect
  }
}
