import 'server-only';

/**
 * SabCRM → SabFlow trigger bindings (server-only).
 *
 * Writes the `sabflow_triggers` index rows that `dispatchSabflowForEvent`
 * (`./sabflow-dispatch.server.ts`) reads via SabFlow's `findMatchingTriggers`.
 * A binding says "when <event> happens on <object> (or any object), run
 * <flow>". It is stored in the SAME `sabflow_triggers` collection the
 * Slack/Telegram receivers use, scoped `source: 'sabcrm'`:
 *
 *   { source:'sabcrm', appEvent:'sabcrm.<event>', externalId:<object?>,
 *     flowId, projectId, isActive }
 *
 * `externalId` carries the object slug for free scoping (omit → any object),
 * because `findMatchingTriggers` already treats a present externalId as an
 * equals-or-wildcard filter.
 *
 * Native-Mongo config pattern (mirrors `./sequences.server.ts`); best-effort.
 */

import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import type { SabcrmWorkflowEvent } from '@/lib/rust-client/sabcrm-workflows';
import { sabcrmAppEvent } from './sabflow-dispatch.server';

const TRIGGERS_COLL = 'sabflow_triggers';
const FLOWS_COLL = 'sabflows';

/** A CRM→flow binding in its friendly API shape. */
export interface SabcrmFlowBinding {
  id: string;
  projectId: string;
  /** Object slug, or '' for "any object". */
  object: string;
  event: SabcrmWorkflowEvent;
  flowId: string;
  isActive: boolean;
}

/** Save-action input. */
export interface SabcrmFlowBindingInput {
  id?: string;
  object: string;
  event: SabcrmWorkflowEvent;
  flowId: string;
  isActive: boolean;
}

interface TriggerRowDoc {
  _id: ObjectId | string;
  source: string;
  appEvent: string;
  externalId?: string;
  flowId: string;
  projectId: string;
  isActive?: boolean;
}

function idHex(id: ObjectId | string): string {
  return id instanceof ObjectId ? id.toHexString() : String(id);
}

function eventFromAppEvent(appEvent: string): SabcrmWorkflowEvent {
  return appEvent.replace(/^sabcrm\./, '') as SabcrmWorkflowEvent;
}

function toBinding(doc: TriggerRowDoc): SabcrmFlowBinding {
  return {
    id: idHex(doc._id),
    projectId: doc.projectId,
    object: doc.externalId ?? '',
    event: eventFromAppEvent(doc.appEvent),
    flowId: doc.flowId,
    isActive: doc.isActive !== false,
  };
}

/** All CRM→flow bindings for a project. */
export async function listSabcrmFlowBindings(
  projectId: string,
): Promise<SabcrmFlowBinding[]> {
  if (!projectId) return [];
  const { db } = await connectToDatabase();
  const rows = (await db
    .collection(TRIGGERS_COLL)
    .find({ source: 'sabcrm', projectId })
    .limit(200)
    .toArray()) as unknown as TriggerRowDoc[];
  return rows.map(toBinding);
}

/** Insert or update a CRM→flow binding. */
export async function upsertSabcrmFlowBinding(
  projectId: string,
  input: SabcrmFlowBindingInput,
): Promise<SabcrmFlowBinding> {
  const { db } = await connectToDatabase();
  const now = new Date().toISOString();
  const fields = {
    source: 'sabcrm',
    appEvent: sabcrmAppEvent(input.event),
    // Omit externalId for an any-object binding (wildcard in findMatchingTriggers).
    externalId: input.object ? input.object : undefined,
    flowId: input.flowId,
    isActive: input.isActive !== false,
    updatedAt: now,
  };
  if (input.id && ObjectId.isValid(input.id)) {
    await db
      .collection(TRIGGERS_COLL)
      .updateOne(
        { _id: new ObjectId(input.id), source: 'sabcrm', projectId },
        { $set: fields, $setOnInsert: { createdAt: now, projectId } },
        { upsert: true },
      );
    const doc = (await db
      .collection(TRIGGERS_COLL)
      .findOne({ _id: new ObjectId(input.id), projectId })) as TriggerRowDoc | null;
    if (doc) return toBinding(doc);
  }
  const res = await db
    .collection(TRIGGERS_COLL)
    .insertOne({ projectId, createdAt: now, ...fields });
  return toBinding({ _id: res.insertedId, projectId, ...fields });
}

/** Delete a CRM→flow binding by id. */
export async function deleteSabcrmFlowBinding(
  projectId: string,
  id: string,
): Promise<boolean> {
  if (!projectId || !ObjectId.isValid(id)) return false;
  const { db } = await connectToDatabase();
  const res = await db
    .collection(TRIGGERS_COLL)
    .deleteOne({ _id: new ObjectId(id), source: 'sabcrm', projectId });
  return res.deletedCount > 0;
}

/** A flow available to bind (project-scoped). */
export interface SabcrmAutomationFlow {
  id: string;
  name: string;
}

/**
 * Flows the project can bind to CRM events. Flows live in `sabflows` keyed by
 * `userId === projectId` (the same lookup `enqueueTriggerJobs` uses).
 */
export async function listSabcrmAutomationFlows(
  projectId: string,
): Promise<SabcrmAutomationFlow[]> {
  if (!projectId) return [];
  const { db } = await connectToDatabase();
  const rows = (await db
    .collection(FLOWS_COLL)
    .find({ userId: projectId })
    .project({ name: 1 })
    .limit(500)
    .toArray()) as Array<{ _id: ObjectId | string; name?: string }>;
  return rows.map((r) => ({
    id: idHex(r._id),
    name: r.name || `Flow ${idHex(r._id).slice(-6)}`,
  }));
}
