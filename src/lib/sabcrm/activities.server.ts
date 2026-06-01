import "server-only";

/**
 * SabCRM — timeline activities runtime (server-only).
 *
 * An "activity" is a timeline entry attached to a single CRM record. SabCRM
 * supports the full interaction set surfaced in a record's detail panel:
 * notes, tasks, calls, meetings, emails and free-form comments. Mirrors
 * Twenty's activity/timeline model where every record shows a chronological
 * feed of everything that happened against it.
 *
 * Tenant-scoped by `projectId`. Every interaction is captured as an activity
 * attached to a target record (`targetObject` + `targetRecordId`) and stamped
 * with the authoring `authorId`. All reads and writes are scoped by
 * `projectId`, and mutations match `{ _id, projectId }` before touching a
 * document so a tenant can never reach another tenant's timeline.
 *
 * Activities support SabFiles attachments and @-mentions. TASK-type activities
 * additionally carry a `status` ({@link TaskStatus}) and an optional assignee /
 * due date so the timeline can render a task list and the board can group by
 * status. The timeline is mutable (edit/delete) so users can correct entries,
 * while `createdAt` is preserved as the canonical ordering key.
 *
 * The canonical persisted shape is {@link SabcrmActivityDoc} (defined in
 * `./db`). This module maps it to the serialisable {@link CrmActivityRecord}
 * (Mongo `_id` → string `_id`) for transport to the gated server actions.
 *
 * All public functions take `projectId` so callers (the gated server actions
 * in `sabcrm.actions.ts`) can never accidentally cross tenant boundaries.
 */

import { ObjectId, type Filter } from "mongodb";

import { sabcrmActivities, ensureSabcrmIndexes } from "./db";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Timeline entry kind. NOTE / TASK / CALL / MEETING / EMAIL log the standard
 * CRM interaction set; COMMENT is a free-form reply on the record timeline.
 * Stored verbatim, so the set is forward-compatible.
 */
export type TimelineActivityType =
  | "NOTE"
  | "TASK"
  | "CALL"
  | "MEETING"
  | "EMAIL"
  | "COMMENT";

/** Every recognised timeline type (used to validate caller input). */
export const TIMELINE_ACTIVITY_TYPES: readonly TimelineActivityType[] = [
  "NOTE",
  "TASK",
  "CALL",
  "MEETING",
  "EMAIL",
  "COMMENT",
] as const;

function isTimelineActivityType(value: unknown): value is TimelineActivityType {
  return (
    typeof value === "string" &&
    (TIMELINE_ACTIVITY_TYPES as readonly string[]).includes(value)
  );
}

/** Status applied to TASK-type activities so they can drive the task board. */
export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";

export const TASK_STATUSES: readonly TaskStatus[] = [
  "TODO",
  "IN_PROGRESS",
  "DONE",
] as const;

function isTaskStatus(value: unknown): value is TaskStatus {
  return value === "TODO" || value === "IN_PROGRESS" || value === "DONE";
}

/**
 * A reference to a file living in SabFiles. We never store raw external URLs —
 * every attachment is sourced from the user's SabFiles library or a fresh
 * upload (via `<SabFilePicker>`) and identified by its stable SabFiles id.
 * The display fields are snapshotted so the timeline renders without a join.
 */
export interface ActivityAttachment {
  /** Stable SabFiles file id (the picker's `pick.id`). */
  fileId: string;
  /** File name snapshot for rendering. */
  name: string;
  /** MIME type, when known. */
  contentType?: string;
  /** Size in bytes, when known. */
  size?: number;
  /** SabFiles-served URL snapshot (managed by SabFiles, never an external paste). */
  url?: string;
}

/** A workspace member referenced via @-mention inside an activity. */
export interface ActivityMention {
  /** User id of the mentioned member. */
  userId: string;
  /** Display-name snapshot, for rendering without a profile lookup. */
  displayName?: string;
}

/**
 * A timeline activity in its serialisable API shape. `_id` is the hex string;
 * timestamps are `Date`s. TASK-only fields (`status`/`assigneeId`/`dueAt`) are
 * present only for TASK activities.
 */
export interface CrmActivityRecord {
  _id: string;
  /** Tenant scope. */
  projectId: string;
  type: TimelineActivityType;
  /** Short title / subject line. */
  title: string;
  /** Free-form body. For comments this is the comment text. */
  body: string;
  /** Object slug of the record this activity is attached to. */
  targetObject: string;
  /** Serialized id of the record this activity is attached to. */
  targetRecordId: string;
  /** Author user id. */
  authorId: string;
  /** SabFiles attachments. Always present (possibly empty). */
  attachments: ActivityAttachment[];
  /** @-mentions resolved against workspace members. Always present (possibly empty). */
  mentions: ActivityMention[];
  /** TASK-only: workflow status. */
  status?: TaskStatus;
  /** TASK-only: assignee user id. */
  assigneeId?: string;
  /** TASK-only: due date. */
  dueAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/* -------------------------------------------------------------------------- */
/* Inputs                                                                     */
/* -------------------------------------------------------------------------- */

export interface CreateActivityInput {
  projectId: string;
  type: TimelineActivityType;
  title: string;
  body?: string;
  targetObject: string;
  targetRecordId: string;
  authorId: string;
  attachments?: ActivityAttachment[];
  mentions?: ActivityMention[];
  /** Only honored for TASK-type activities. Defaults to "TODO". */
  status?: TaskStatus;
  /** Only honored for TASK-type activities. */
  assigneeId?: string;
  /** Only honored for TASK-type activities. Accepts a Date or ISO string. */
  dueAt?: Date | string;
}

export interface UpdateActivityInput {
  title?: string;
  body?: string;
  type?: TimelineActivityType;
  attachments?: ActivityAttachment[];
  mentions?: ActivityMention[];
  status?: TaskStatus;
  /** Pass `null` to clear the assignee. */
  assigneeId?: string | null;
  /** Pass `null` to clear the due date. Accepts a Date or ISO string. */
  dueAt?: Date | string | null;
}

export interface ListActivitiesQuery {
  projectId: string;
  targetObject: string;
  targetRecordId: string;
  page?: number;
  pageSize?: number;
  /** Optional filter to a single activity type. */
  type?: TimelineActivityType;
}

export interface ActivityPage {
  activities: CrmActivityRecord[];
  total: number;
  page: number;
  pageSize: number;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

async function activitiesCol() {
  await ensureSabcrmIndexes();
  return sabcrmActivities();
}

function toObjectId(id: string): ObjectId | null {
  return ObjectId.isValid(id) ? new ObjectId(id) : null;
}

function sanitizeAttachments(
  input: ActivityAttachment[] | undefined,
): ActivityAttachment[] {
  if (!Array.isArray(input)) return [];
  const out: ActivityAttachment[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    if (!raw || typeof raw.fileId !== "string" || !raw.fileId.trim()) continue;
    if (seen.has(raw.fileId)) continue;
    seen.add(raw.fileId);
    const att: ActivityAttachment = {
      fileId: raw.fileId,
      name:
        typeof raw.name === "string" && raw.name.trim() ? raw.name : raw.fileId,
    };
    if (typeof raw.contentType === "string" && raw.contentType) {
      att.contentType = raw.contentType;
    }
    if (typeof raw.size === "number" && Number.isFinite(raw.size)) {
      att.size = raw.size;
    }
    if (typeof raw.url === "string" && raw.url) att.url = raw.url;
    out.push(att);
  }
  return out;
}

function sanitizeMentions(
  input: ActivityMention[] | undefined,
): ActivityMention[] {
  if (!Array.isArray(input)) return [];
  const out: ActivityMention[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    if (!raw || typeof raw.userId !== "string" || !raw.userId.trim()) continue;
    if (seen.has(raw.userId)) continue;
    seen.add(raw.userId);
    const m: ActivityMention = { userId: raw.userId };
    if (typeof raw.displayName === "string" && raw.displayName) {
      m.displayName = raw.displayName;
    }
    out.push(m);
  }
  return out;
}

function toDate(value: unknown): Date | undefined {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return undefined;
}

function toActivity(doc: Record<string, unknown>): CrmActivityRecord {
  const id =
    doc._id instanceof ObjectId ? doc._id.toHexString() : String(doc._id);
  const type: TimelineActivityType = isTimelineActivityType(doc.type)
    ? doc.type
    : "NOTE";
  const result: CrmActivityRecord = {
    _id: id,
    projectId: String(doc.projectId ?? ""),
    type,
    title: typeof doc.title === "string" ? doc.title : "",
    body: typeof doc.body === "string" ? doc.body : "",
    targetObject: String(doc.targetObject ?? ""),
    targetRecordId: String(doc.targetRecordId ?? ""),
    authorId: String(doc.authorId ?? ""),
    attachments: sanitizeAttachments(
      doc.attachments as ActivityAttachment[] | undefined,
    ),
    mentions: sanitizeMentions(doc.mentions as ActivityMention[] | undefined),
    createdAt: toDate(doc.createdAt) ?? new Date(0),
    updatedAt: toDate(doc.updatedAt) ?? new Date(0),
  };
  if (type === "TASK") {
    result.status = isTaskStatus(doc.status) ? doc.status : "TODO";
    if (typeof doc.assigneeId === "string" && doc.assigneeId) {
      result.assigneeId = doc.assigneeId;
    }
    const due = toDate(doc.dueAt);
    if (due) result.dueAt = due;
  }
  return result;
}

function tenantFilter(
  projectId: string,
  id: ObjectId,
): Filter<Record<string, unknown>> {
  return { _id: id, projectId } as Filter<Record<string, unknown>>;
}

/* -------------------------------------------------------------------------- */
/* Read                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * List the timeline for a record, newest first, paginated. Scoped to
 * `projectId` + `targetObject` + `targetRecordId`. Passing empty target
 * strings widens the query to the tenant-wide feed (used by "my open tasks").
 */
export async function listActivities(
  query: ListActivitiesQuery,
): Promise<ActivityPage> {
  const col = await activitiesCol();
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, query.pageSize ?? 20));

  const filter: Record<string, unknown> = { projectId: query.projectId };
  if (query.targetObject) filter.targetObject = query.targetObject;
  if (query.targetRecordId) filter.targetRecordId = query.targetRecordId;
  if (query.type && isTimelineActivityType(query.type)) filter.type = query.type;

  const mongoFilter = filter as Filter<Record<string, unknown>>;
  const total = await col.countDocuments(mongoFilter);
  const docs = await col
    .find(mongoFilter)
    .sort({ createdAt: -1, _id: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .toArray();
  const activities = docs.map((d) => toActivity(d as Record<string, unknown>));
  return { activities, total, page, pageSize };
}

/**
 * Fetch a single activity by id, scoped to the tenant. Returns `null` when the
 * id is malformed or the activity belongs to another tenant.
 */
export async function getActivity(
  projectId: string,
  id: string,
): Promise<CrmActivityRecord | null> {
  const oid = toObjectId(id);
  if (!oid) return null;
  const col = await activitiesCol();
  const doc = await col.findOne(tenantFilter(projectId, oid));
  if (!doc) return null;
  return toActivity(doc as Record<string, unknown>);
}

/* -------------------------------------------------------------------------- */
/* Write                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Create a timeline activity attached to a record. The document is scoped to
 * `input.projectId` and stamped with `input.authorId`. TASK activities default
 * to status "TODO". Attachments are SabFiles refs (never external URLs).
 */
export async function createActivity(
  input: CreateActivityInput,
): Promise<CrmActivityRecord> {
  const col = await activitiesCol();
  const now = new Date();

  const doc: Record<string, unknown> = {
    projectId: input.projectId,
    type: input.type,
    title: input.title.trim(),
    body: input.body?.trim() ?? "",
    targetObject: input.targetObject,
    targetRecordId: input.targetRecordId,
    authorId: input.authorId,
    attachments: sanitizeAttachments(input.attachments),
    mentions: sanitizeMentions(input.mentions),
    createdAt: now,
    updatedAt: now,
  };

  if (input.type === "TASK") {
    doc.status = isTaskStatus(input.status) ? input.status : "TODO";
    if (typeof input.assigneeId === "string" && input.assigneeId) {
      doc.assigneeId = input.assigneeId;
    }
    const due = toDate(input.dueAt);
    if (due) doc.dueAt = due;
  }

  const result = await col.insertOne(
    doc as unknown as Parameters<typeof col.insertOne>[0],
  );
  return toActivity({ ...doc, _id: result.insertedId });
}

/**
 * Patch an activity in place. Matched by `{ _id, projectId }` so a tenant can
 * never edit another tenant's entry. Passing `dueAt`/`assigneeId` as `null`
 * clears those TASK fields; `attachments`/`mentions` replace the whole set.
 * Returns the updated record, or `null` if it does not exist / id is malformed.
 */
export async function updateActivity(
  projectId: string,
  id: string,
  patch: UpdateActivityInput,
): Promise<CrmActivityRecord | null> {
  const oid = toObjectId(id);
  if (!oid) return null;
  const col = await activitiesCol();

  const set: Record<string, unknown> = { updatedAt: new Date() };
  const unset: Record<string, unknown> = {};

  if (typeof patch.title === "string") set.title = patch.title.trim();
  if (typeof patch.body === "string") set.body = patch.body.trim();
  if (patch.type && isTimelineActivityType(patch.type)) set.type = patch.type;
  if (patch.attachments !== undefined) {
    set.attachments = sanitizeAttachments(patch.attachments);
  }
  if (patch.mentions !== undefined) {
    set.mentions = sanitizeMentions(patch.mentions);
  }
  if (patch.status !== undefined && isTaskStatus(patch.status)) {
    set.status = patch.status;
  }
  if (patch.assigneeId !== undefined) {
    if (patch.assigneeId === null || patch.assigneeId === "") {
      unset.assigneeId = "";
    } else {
      set.assigneeId = patch.assigneeId;
    }
  }
  if (patch.dueAt !== undefined) {
    const due = patch.dueAt === null ? undefined : toDate(patch.dueAt);
    if (due) {
      set.dueAt = due;
    } else {
      unset.dueAt = "";
    }
  }

  const update: Record<string, unknown> = { $set: set };
  if (Object.keys(unset).length > 0) update.$unset = unset;

  const result = await col.findOneAndUpdate(
    tenantFilter(projectId, oid),
    update,
    { returnDocument: "after" },
  );
  if (!result) return null;
  return toActivity(result as Record<string, unknown>);
}

/**
 * Delete a timeline activity. Matched by `{ _id, projectId }` so the deletion
 * is tenant-scoped. Returns `true` only when a document was removed.
 */
export async function deleteActivity(
  projectId: string,
  id: string,
): Promise<boolean> {
  const oid = toObjectId(id);
  if (!oid) return false;
  const col = await activitiesCol();
  const result = await col.deleteOne(tenantFilter(projectId, oid));
  return result.deletedCount === 1;
}

/**
 * Cascade-delete every activity attached to a record. Called when the parent
 * record itself is deleted so the timeline never orphans. Tenant-scoped;
 * returns the number of activities removed.
 */
export async function deleteActivitiesForRecord(
  projectId: string,
  targetObject: string,
  targetRecordId: string,
): Promise<number> {
  if (!projectId || !targetObject || !targetRecordId) return 0;
  const col = await activitiesCol();
  const result = await col.deleteMany({
    projectId,
    targetObject,
    targetRecordId,
  } as Filter<Record<string, unknown>>);
  return result.deletedCount ?? 0;
}

/* -------------------------------------------------------------------------- */
/* Task helpers                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Set the status of a TASK-type activity. Scoped to
 * `{ _id, projectId, type: 'TASK' }`, so it is a no-op (returns `null`) on a
 * missing, cross-tenant, or non-TASK activity.
 */
export async function setTaskStatus(
  projectId: string,
  id: string,
  status: TaskStatus,
): Promise<CrmActivityRecord | null> {
  if (!isTaskStatus(status)) return null;
  const oid = toObjectId(id);
  if (!oid) return null;
  const col = await activitiesCol();
  const result = await col.findOneAndUpdate(
    { _id: oid, projectId, type: "TASK" } as Filter<Record<string, unknown>>,
    { $set: { status, updatedAt: new Date() } },
    { returnDocument: "after" },
  );
  if (!result) return null;
  return toActivity(result as Record<string, unknown>);
}

/**
 * Assign (or, when `assigneeId` is `null`, unassign) a TASK-type activity.
 * Scoped to `{ _id, projectId, type: 'TASK' }`, so it is a no-op (returns
 * `null`) on a missing, cross-tenant, or non-TASK activity.
 */
export async function assignTask(
  projectId: string,
  id: string,
  assigneeId: string | null,
): Promise<CrmActivityRecord | null> {
  const oid = toObjectId(id);
  if (!oid) return null;
  const col = await activitiesCol();
  const now = new Date();
  const update: Record<string, unknown> =
    assigneeId && assigneeId.trim()
      ? { $set: { assigneeId, updatedAt: now } }
      : { $set: { updatedAt: now }, $unset: { assigneeId: "" } };
  const result = await col.findOneAndUpdate(
    { _id: oid, projectId, type: "TASK" } as Filter<Record<string, unknown>>,
    update,
    { returnDocument: "after" },
  );
  if (!result) return null;
  return toActivity(result as Record<string, unknown>);
}
