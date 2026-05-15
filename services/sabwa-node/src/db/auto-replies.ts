/**
 * Auto-reply persistence helpers for `sabwa_auto_replies`.
 *
 * The on-disk shape is a superset of `SabwaAutoReply` in
 * `src/lib/sabwa/types.ts` — it adds an `order: number` column so rules are
 * displayed (and matched) in deterministic priority order within a session.
 *
 * Wire-format compatibility note: the public API accepts and emits both the
 * canonical plural form (`triggers: SabwaAutoReplyTrigger[]`,
 * `actions: SabwaAutoReplyAction[]`) and the convenience singular form
 * (`trigger`, `action`). Internally everything is stored as arrays.
 */

import { Collection, ObjectId, type Db, type Filter } from 'mongodb';
import type { AppState } from '../state.js';

export type AutoReplyTriggerKind =
  | 'keyword'
  | 'contains'
  | 'contains_all'
  | 'contains_any'
  | 'regex'
  | 'time_window'
  | 'time_of_day'
  | 'contact_label'
  | 'outside_business_hours'
  | 'first_message_from_new_contact';

export type AutoReplyActionKind =
  | 'send_template'
  | 'send_message'
  | 'forward_to_flow'
  | 'set_away_message'
  | 'add_label'
  | 'set_label';

export interface AutoReplyTrigger {
  kind: AutoReplyTriggerKind;
  value?: string;
  /** For `time_window`/`time_of_day` (e.g. "09:00"). */
  start?: string;
  end?: string;
  /** 0–6 (Sun–Sat). */
  daysOfWeek?: number[];
  /** For `regex` triggers — optional flag string (e.g. "i"). */
  flags?: string;
  /** Case-insensitive match for keyword/contains family. */
  caseSensitive?: boolean;
}

export interface AutoReplyAction {
  kind: AutoReplyActionKind;
  templateId?: string;
  flowId?: string;
  labelId?: string;
  message?: string;
}

export interface AutoReplyDoc {
  _id: ObjectId;
  projectId: ObjectId;
  sessionId: ObjectId;
  name: string;
  enabled: boolean;
  triggers: AutoReplyTrigger[];
  actions: AutoReplyAction[];
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AutoReplyWire {
  id: string;
  projectId: string;
  sessionId: string;
  name: string;
  enabled: boolean;
  triggers: AutoReplyTrigger[];
  actions: AutoReplyAction[];
  /** Convenience aliases — first trigger / first action. */
  trigger?: AutoReplyTrigger;
  action?: AutoReplyAction;
  order: number;
  createdAt: string;
  updatedAt: string;
}

const COLL = 'sabwa_auto_replies';

function coll(db: Db): Collection<AutoReplyDoc> {
  return db.collection<AutoReplyDoc>(COLL);
}

function toWire(d: AutoReplyDoc): AutoReplyWire {
  const wire: AutoReplyWire = {
    id: d._id.toHexString(),
    projectId: d.projectId.toHexString(),
    sessionId: d.sessionId.toHexString(),
    name: d.name,
    enabled: d.enabled,
    triggers: d.triggers ?? [],
    actions: d.actions ?? [],
    order: d.order ?? 0,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  };
  if (wire.triggers.length > 0) wire.trigger = wire.triggers[0];
  if (wire.actions.length > 0) wire.action = wire.actions[0];
  return wire;
}

/** Accept both `triggers[]` and singular `trigger`. */
export function normaliseTriggers(
  triggers?: AutoReplyTrigger[] | null,
  trigger?: AutoReplyTrigger | null,
): AutoReplyTrigger[] {
  if (Array.isArray(triggers) && triggers.length > 0) return triggers;
  if (trigger) return [trigger];
  return [];
}

export function normaliseActions(
  actions?: AutoReplyAction[] | null,
  action?: AutoReplyAction | null,
): AutoReplyAction[] {
  if (Array.isArray(actions) && actions.length > 0) return actions;
  if (action) return [action];
  return [];
}

export async function listAutoReplies(
  state: AppState,
  sessionId: string,
): Promise<AutoReplyWire[]> {
  if (!ObjectId.isValid(sessionId)) return [];
  const docs = await coll(state.db)
    .find({ sessionId: new ObjectId(sessionId) })
    .sort({ order: 1, createdAt: 1 })
    .toArray();
  return docs.map(toWire);
}

/**
 * Listing variant for the matcher: only enabled rules, returned as raw docs
 * (we need `_id` as an `ObjectId` to read `templateId` references).
 */
export async function listEnabledForMatching(
  state: AppState,
  sessionId: string | ObjectId,
): Promise<AutoReplyDoc[]> {
  const sid = sessionId instanceof ObjectId ? sessionId : new ObjectId(sessionId);
  return coll(state.db)
    .find({ sessionId: sid, enabled: true })
    .sort({ order: 1, createdAt: 1 })
    .toArray();
}

export interface CreateAutoReplyInput {
  projectId: string;
  sessionId: string;
  name: string;
  triggers: AutoReplyTrigger[];
  actions: AutoReplyAction[];
  enabled: boolean;
}

export async function createAutoReply(
  state: AppState,
  input: CreateAutoReplyInput,
): Promise<AutoReplyWire | null> {
  if (!ObjectId.isValid(input.projectId) || !ObjectId.isValid(input.sessionId)) return null;
  const sessionId = new ObjectId(input.sessionId);
  // New rules go to the bottom by default.
  const last = await coll(state.db)
    .find({ sessionId })
    .sort({ order: -1 })
    .limit(1)
    .toArray();
  const order = (last[0]?.order ?? -1) + 1;
  const now = new Date();
  const doc: AutoReplyDoc = {
    _id: new ObjectId(),
    projectId: new ObjectId(input.projectId),
    sessionId,
    name: input.name,
    enabled: input.enabled,
    triggers: input.triggers,
    actions: input.actions,
    order,
    createdAt: now,
    updatedAt: now,
  };
  await coll(state.db).insertOne(doc);
  return toWire(doc);
}

export interface PatchAutoReplyInput {
  name?: string;
  enabled?: boolean;
  triggers?: AutoReplyTrigger[];
  actions?: AutoReplyAction[];
  order?: number;
}

export async function patchAutoReply(
  state: AppState,
  id: string,
  patch: PatchAutoReplyInput,
): Promise<AutoReplyWire | null> {
  if (!ObjectId.isValid(id)) return null;
  const update: Partial<AutoReplyDoc> = { updatedAt: new Date() };
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.enabled !== undefined) update.enabled = patch.enabled;
  if (patch.triggers !== undefined) update.triggers = patch.triggers;
  if (patch.actions !== undefined) update.actions = patch.actions;
  if (patch.order !== undefined) update.order = patch.order;
  const r = await coll(state.db).findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: update },
    { returnDocument: 'after' },
  );
  return r ? toWire(r) : null;
}

export async function deleteAutoReply(state: AppState, id: string): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false;
  const r = await coll(state.db).deleteOne({ _id: new ObjectId(id) });
  return r.deletedCount === 1;
}

/** Find a single auto-reply (used by audit metadata). */
export async function findAutoReply(
  state: AppState,
  id: string,
): Promise<AutoReplyDoc | null> {
  if (!ObjectId.isValid(id)) return null;
  return coll(state.db).findOne({ _id: new ObjectId(id) });
}

/** Atomic-ish reorder via bulkWrite (one update per id). */
export async function reorderAutoReplies(
  state: AppState,
  sessionId: string,
  orderedIds: string[],
): Promise<boolean> {
  if (!ObjectId.isValid(sessionId)) return false;
  const ids = orderedIds.filter((id) => ObjectId.isValid(id));
  if (ids.length === 0) return true;
  const sid = new ObjectId(sessionId);
  const ops = ids.map((id, idx) => ({
    updateOne: {
      filter: { _id: new ObjectId(id), sessionId: sid } as Filter<AutoReplyDoc>,
      update: { $set: { order: idx, updatedAt: new Date() } },
    },
  }));
  await coll(state.db).bulkWrite(ops, { ordered: false });
  return true;
}

export const __forTest = { COLL, toWire };
