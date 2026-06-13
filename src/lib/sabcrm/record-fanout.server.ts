import 'server-only';

/**
 * SabCRM — record-mutation fan-out (server-only).
 *
 * One best-effort side-effect bundle fired from the record create/update actions
 * so `sabcrm-twenty.actions.ts` stays to two call sites instead of a dozen
 * inline awaits:
 *   - durable notification inbox (assignment) → the bell (notifications.server)
 *   - marketing attribution: record a touch + emit a SabSense lifecycle event
 *   - signed outbound webhook delivery (record.created / record.updated)
 *
 * Every step is independently try/caught and NEVER throws — a downed inbox /
 * SabSense / webhook endpoint must not break the record write. No record
 * `data.*` scalar is written here (no AI-fields-envelope concern).
 */

import { notify } from './notifications.server';
import { recordTouch, emitCrmEventToSabsense } from './attribution.server';
import { deliverEvent } from './webhook-delivery.server';

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function firstStr(...vals: unknown[]): string {
  for (const v of vals) {
    const s = str(v);
    if (s) return s;
  }
  return '';
}

function assigneeFrom(data: Record<string, unknown>): string {
  const direct = str(data.assigneeId);
  if (direct) return direct;
  const obj = data.assignee as { id?: string } | undefined;
  return str(obj?.id);
}

const WON_RE = /\bwon\b|customer|closed.?won|complete/i;

/** Fan-out for a freshly CREATED record. Best-effort; never throws. */
export async function fanoutRecordCreated(
  projectId: string,
  userId: string,
  object: string,
  recordId: string,
  data: Record<string, unknown>,
): Promise<void> {
  try {
    const assignee = assigneeFrom(data);
    if (assignee) {
      await notify({
        projectId,
        userId: assignee,
        kind: 'assignment',
        actorId: userId,
        target: { object, recordId },
      });
    }
    const source = firstStr(data.source, data.leadSource, data.utmSource);
    if (source) {
      await recordTouch(projectId, object, recordId, {
        source,
        campaign: firstStr(data.campaign, data.utmCampaign) || undefined,
        medium: firstStr(data.medium, data.utmMedium) || undefined,
        at: new Date().toISOString(),
        origin: 'lead.created',
      });
    }
    await emitCrmEventToSabsense(projectId, {
      type: 'lead.created',
      object,
      recordId,
      source: source || undefined,
      campaign: firstStr(data.campaign, data.utmCampaign) || undefined,
    });
    await deliverEvent(projectId, 'record.created', { object, recordId, data });
  } catch {
    /* fan-out is best-effort */
  }
}

/**
 * Fan-out for an UPDATED record. `recordData` is the post-write record bag (for
 * stage/revenue), `patch` is what the caller changed (to detect assignment /
 * stage moves). Best-effort; never throws.
 */
export async function fanoutRecordUpdated(
  projectId: string,
  userId: string,
  object: string,
  recordId: string,
  patch: Record<string, unknown>,
  recordData: Record<string, unknown>,
): Promise<void> {
  try {
    const assignee =
      'assigneeId' in patch || 'assignee' in patch ? assigneeFrom(patch) : '';
    if (assignee) {
      await notify({
        projectId,
        userId: assignee,
        kind: 'assignment',
        actorId: userId,
        target: { object, recordId },
      });
    }

    const stageTouched = 'stage' in patch || 'status' in patch;
    if (stageTouched) {
      const newStage = firstStr(recordData.stage, recordData.status);
      if (WON_RE.test(newStage)) {
        const amt = recordData.amount;
        await emitCrmEventToSabsense(projectId, {
          type: 'deal.won',
          object,
          recordId,
          revenue: typeof amt === 'number' ? amt : Number(amt) || 0,
          source: str(recordData.source) || undefined,
          campaign: str(recordData.campaign) || undefined,
        });
      } else {
        await emitCrmEventToSabsense(projectId, {
          type: 'stage.moved',
          object,
          recordId,
          toStage: newStage || undefined,
        });
      }
    }

    await deliverEvent(projectId, 'record.updated', {
      object,
      recordId,
      data: recordData,
    });
  } catch {
    /* fan-out is best-effort */
  }
}
