/**
 * `sabwa_scheduled` repository — one-off and recurring outbound messages.
 *
 * Mirrors `services/sabwa-engine/src/db/scheduled.rs` so the Node engine and
 * the Rust engine remain swappable behind the same HTTP contract.
 *
 * Document shape (camelCase, matches the `ScheduledRow` DTO exposed by
 * `routes/scheduled.ts`):
 *
 *   {
 *     _id:           string            // "sch_<uuid>"
 *     projectId?:    string
 *     sessionId:     string
 *     kind:          'one_off' | 'recurring'
 *     scheduledFor:  Date              // UTC instant we should fire at
 *     cron?:         string            // only on `recurring`
 *     timezone?:     string            // IANA zone, defaults to 'UTC'
 *     targets:       { jid, type }[]
 *     payload:       JsonValue         // raw send payload (text/media/...)
 *     status:        'pending'|'sent'|'failed'|'cancelled'
 *     attemptCount:  number
 *     lastError?:    string
 *     sentAt?:       Date
 *     // recurring-parent bookkeeping:
 *     parentId?:     string            // set on materialised child rows
 *     lastFiredAt?:  Date              // set on the parent each time we
 *                                      // materialise the next instance
 *     createdAt:     Date
 *     updatedAt:     Date
 *   }
 *
 * The `findDue` query is the hot path — every tick the scheduler runs
 *   { status: 'pending', scheduledFor: { $lte: now } }
 * against this collection. A compound index on `(status, scheduledFor)` is
 * created lazily on first call.
 */

import { type Db, type Collection } from 'mongodb';

export const COLLECTION = 'sabwa_scheduled';

export type ScheduledKind = 'one_off' | 'recurring';
export type ScheduledStatus = 'pending' | 'sent' | 'failed' | 'cancelled';
export type ScheduledTargetType = 'individual' | 'group' | 'broadcast';

export interface ScheduledTarget {
  jid: string;
  /** Stored under `type` to match the Rust engine's wire contract. */
  type: ScheduledTargetType;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type JsonValue = any;

export interface ScheduledDoc {
  _id: string;
  projectId?: string;
  sessionId: string;
  kind: ScheduledKind;
  scheduledFor: Date;
  cron?: string;
  timezone?: string;
  targets: ScheduledTarget[];
  payload: JsonValue;
  status: ScheduledStatus;
  attemptCount: number;
  lastError?: string;
  sentAt?: Date;
  parentId?: string;
  lastFiredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/** Wire shape returned by `GET /v1/scheduled` — `id` instead of `_id`. */
export interface ScheduledRow {
  id: string;
  sessionId: string;
  kind: ScheduledKind;
  scheduledFor: Date;
  cron: string | null;
  timezone: string | null;
  status: ScheduledStatus;
  attemptCount: number;
  lastError: string | null;
  sentAt: Date | null;
  targets: ScheduledTarget[];
  payload: JsonValue;
}

function collection(db: Db): Collection<ScheduledDoc> {
  return db.collection<ScheduledDoc>(COLLECTION);
}

export function toRow(doc: ScheduledDoc): ScheduledRow {
  return {
    id: doc._id,
    sessionId: doc.sessionId,
    kind: doc.kind,
    scheduledFor: doc.scheduledFor,
    cron: doc.cron ?? null,
    timezone: doc.timezone ?? null,
    status: doc.status,
    attemptCount: doc.attemptCount ?? 0,
    lastError: doc.lastError ?? null,
    sentAt: doc.sentAt ?? null,
    targets: doc.targets ?? [],
    payload: doc.payload ?? null,
  };
}

let indexEnsured = false;
async function ensureIndexes(db: Db): Promise<void> {
  if (indexEnsured) return;
  indexEnsured = true;
  try {
    await collection(db).createIndex(
      { status: 1, scheduledFor: 1 },
      { name: 'status_scheduledFor' },
    );
    await collection(db).createIndex(
      { sessionId: 1, scheduledFor: 1 },
      { name: 'sessionId_scheduledFor' },
    );
  } catch {
    // index creation is best-effort; the queries still work without it.
  }
}

export interface InsertParams {
  _id: string;
  projectId?: string;
  sessionId: string;
  kind: ScheduledKind;
  scheduledFor: Date;
  cron?: string;
  timezone?: string;
  targets: ScheduledTarget[];
  payload: JsonValue;
  /** Set when this row is a materialised child of a recurring parent. */
  parentId?: string;
}

/** Insert a new pending row. */
export async function insert(db: Db, params: InsertParams): Promise<ScheduledDoc> {
  await ensureIndexes(db);
  const now = new Date();
  const doc: ScheduledDoc = {
    _id: params._id,
    projectId: params.projectId,
    sessionId: params.sessionId,
    kind: params.kind,
    scheduledFor: params.scheduledFor,
    cron: params.cron,
    timezone: params.timezone ?? 'UTC',
    targets: params.targets,
    payload: params.payload,
    status: 'pending',
    attemptCount: 0,
    parentId: params.parentId,
    createdAt: now,
    updatedAt: now,
  };
  await collection(db).insertOne(doc);
  return doc;
}

/**
 * Find all `pending` rows whose `scheduledFor` is in the past, oldest first.
 * `limit` caps the batch the worker drains per tick.
 *
 * Recurring parent rows are **excluded** from this query — they materialise
 * children via `next-instance` insertion rather than firing themselves. The
 * children carry `kind: 'one_off'` so they drop into this query naturally.
 */
export async function findDue(db: Db, now: Date, limit = 100): Promise<ScheduledDoc[]> {
  await ensureIndexes(db);
  return collection(db)
    .find({
      status: 'pending',
      scheduledFor: { $lte: now },
      kind: { $ne: 'recurring' },
    })
    .sort({ scheduledFor: 1 })
    .limit(Math.max(1, limit))
    .toArray();
}

/** Find all `pending` recurring parents that are eligible for materialisation. */
export async function findRecurringParents(db: Db): Promise<ScheduledDoc[]> {
  await ensureIndexes(db);
  return collection(db)
    .find({ status: 'pending', kind: 'recurring', cron: { $exists: true } })
    .toArray();
}

export async function findById(db: Db, id: string): Promise<ScheduledDoc | null> {
  return collection(db).findOne({ _id: id });
}

/** Flip status → `sent` and stamp `sentAt`. */
export async function markSent(db: Db, id: string): Promise<void> {
  const now = new Date();
  await collection(db).updateOne(
    { _id: id },
    {
      $set: { status: 'sent', sentAt: now, updatedAt: now, lastError: undefined },
      $inc: { attemptCount: 1 },
    },
  );
}

/** Flip status → `failed`, persist the error message, bump `attemptCount`. */
export async function markFailed(db: Db, id: string, error: string): Promise<void> {
  const now = new Date();
  await collection(db).updateOne(
    { _id: id },
    {
      $set: { status: 'failed', lastError: error, updatedAt: now },
      $inc: { attemptCount: 1 },
    },
  );
}

export interface UpdateParams {
  scheduledFor?: Date;
  cron?: string;
  timezone?: string;
  targets?: ScheduledTarget[];
  payload?: JsonValue;
}

/** Apply a patch. Returns `true` if a row was modified. */
export async function update(db: Db, id: string, patch: UpdateParams): Promise<boolean> {
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.scheduledFor !== undefined) set.scheduledFor = patch.scheduledFor;
  if (patch.cron !== undefined) set.cron = patch.cron;
  if (patch.timezone !== undefined) set.timezone = patch.timezone;
  if (patch.targets !== undefined) set.targets = patch.targets;
  if (patch.payload !== undefined) set.payload = patch.payload;
  const res = await collection(db).updateOne(
    { _id: id, status: 'pending' },
    { $set: set },
  );
  return res.modifiedCount > 0;
}

/** Cancel a pending row (idempotent — non-pending rows are left alone). */
export async function cancel(db: Db, id: string): Promise<boolean> {
  const res = await collection(db).updateOne(
    { _id: id, status: 'pending' },
    { $set: { status: 'cancelled', updatedAt: new Date() } },
  );
  return res.modifiedCount > 0;
}

/** List rows for a session, optionally filtered by status. */
export async function listBySession(
  db: Db,
  sessionId: string,
  status?: ScheduledStatus,
): Promise<ScheduledDoc[]> {
  await ensureIndexes(db);
  const filter: Record<string, unknown> = { sessionId };
  if (status) filter.status = status;
  return collection(db).find(filter).sort({ scheduledFor: 1 }).toArray();
}

/** Stamp `lastFiredAt` on a recurring parent after materialising a child. */
export async function setLastFiredAt(db: Db, id: string, when: Date): Promise<void> {
  await collection(db).updateOne(
    { _id: id },
    { $set: { lastFiredAt: when, updatedAt: new Date() } },
  );
}

/** Attach an error message to a row without changing its status. */
export async function setLastError(db: Db, id: string, error: string): Promise<void> {
  await collection(db).updateOne(
    { _id: id },
    { $set: { lastError: error, updatedAt: new Date() } },
  );
}

/** Push a recurring parent forward to the next computed fire time. */
export async function advanceRecurringParent(
  db: Db,
  id: string,
  nextFireAt: Date,
): Promise<void> {
  await collection(db).updateOne(
    { _id: id },
    { $set: { scheduledFor: nextFireAt, updatedAt: new Date() } },
  );
}

/** Retire a recurring parent (e.g. its cron no longer yields future fires). */
export async function retireRecurringParent(db: Db, id: string): Promise<void> {
  await collection(db).updateOne(
    { _id: id },
    { $set: { status: 'sent', updatedAt: new Date() } },
  );
}
