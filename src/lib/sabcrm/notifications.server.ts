import 'server-only';

/**
 * SabCRM — persistent notification inbox runtime (server-only).
 *
 * Owns the `sabcrm_notifications` collection: the durable, per-recipient inbox
 * behind the SabCRM notification bell. Rows are scoped to `userId` + `projectId`
 * and carry a {@link NotificationKind}, `title`, optional `body`/`href`, a
 * `target` (object + record), `read` flag and `createdAt`.
 *
 * The pure title/body/href/grouping math lives in `./notifications.ts` and is
 * re-exported here so callers only import from this file (the structural twin of
 * `./scoring.server.ts` ⇄ `./scoring.ts`).
 *
 * ## This module OWNS `notify()`
 *
 * `notify({ projectId, userId, kind, ... })` is the single enqueue point used by
 * comments-mentions, assignment changes, SLA breaches and approvals. It is
 * best-effort by design — a downed DB must never break the record mutation that
 * triggered it (mirrors `recomputeScoresForRecord`). It de-duplicates obvious
 * self-notifications (`userId === actorId`) and stamps the derived
 * title/body/href when the caller omits them.
 *
 * Reads (`listNotifications` / `unreadCount`) and writes (`markRead` /
 * `markAllRead`) are always scoped by `{ userId, projectId }` so a member can
 * only ever touch their OWN inbox — the gated actions in
 * `src/app/actions/sabcrm-notification-inbox.actions.ts` re-resolve the session
 * user and never accept a client-supplied recipient.
 *
 * This is a NEW domain collection (not a record `data.*` write), so it MAY carry
 * its own timestamps — there is no `sabcrm_records.updatedAt` to protect here.
 */

import { ObjectId, type Filter } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import {
  buildTitle,
  buildBody,
  buildHref,
  isNotificationKind,
  type NotifyInput,
  type SabcrmInboxNotification,
  type NotificationTarget,
} from './notifications';

export {
  NOTIFICATION_KINDS,
  isNotificationKind,
  iconForKind,
  truncate,
  buildTitle,
  buildBody,
  buildHref,
  countUnread,
  dayBucketFor,
  groupByDay,
  type NotificationKind,
  type NotificationTarget,
  type SabcrmInboxNotification,
  type NotifyInput,
  type NotificationGroup,
  type DayBucket,
} from './notifications';

const COLL = 'sabcrm_notifications';

/** Hard cap on a single list page so a noisy inbox can't blow out a response. */
const MAX_PAGE = 100;
/** Default list page size. */
const DEFAULT_PAGE = 30;

/** Raw Mongo doc shape for a stored notification. */
interface NotificationDoc {
  _id: ObjectId | string;
  projectId: string;
  userId: string;
  kind: string;
  title: string;
  body?: string;
  href?: string;
  target?: NotificationTarget;
  actorId?: string;
  actorName?: string;
  read?: boolean;
  createdAt?: Date | string;
}

/** Hex-stringify a Mongo `_id` regardless of stored type. */
function idHex(id: ObjectId | string): string {
  return id instanceof ObjectId ? id.toHexString() : String(id);
}

/** ISO-string a stored timestamp (Date or string) defensively. */
function toIso(v: Date | string | undefined): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'string') {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date(0).toISOString();
}

/** Sanitize a caller-supplied target (strings only; drop blanks). */
function sanitizeTarget(t: unknown): NotificationTarget | undefined {
  if (!t || typeof t !== 'object') return undefined;
  const raw = t as Record<string, unknown>;
  const object = typeof raw.object === 'string' ? raw.object.trim() : '';
  const recordId = typeof raw.recordId === 'string' ? raw.recordId.trim() : '';
  if (!object || !recordId) return undefined;
  const out: NotificationTarget = { object, recordId };
  if (typeof raw.label === 'string' && raw.label.trim()) out.label = raw.label.trim();
  return out;
}

/** Normalize a persisted doc into the serialisable API shape. */
function toNotification(doc: NotificationDoc): SabcrmInboxNotification {
  const kind = isNotificationKind(doc.kind) ? doc.kind : 'system';
  const out: SabcrmInboxNotification = {
    id: idHex(doc._id),
    projectId: String(doc.projectId ?? ''),
    userId: String(doc.userId ?? ''),
    kind,
    title: typeof doc.title === 'string' ? doc.title : '',
    read: doc.read === true,
    createdAt: toIso(doc.createdAt),
  };
  if (typeof doc.body === 'string' && doc.body) out.body = doc.body;
  if (typeof doc.href === 'string' && doc.href) out.href = doc.href;
  const target = sanitizeTarget(doc.target);
  if (target) out.target = target;
  if (typeof doc.actorId === 'string' && doc.actorId) out.actorId = doc.actorId;
  if (typeof doc.actorName === 'string' && doc.actorName) out.actorName = doc.actorName;
  return out;
}

/* -------------------------------------------------------------------------- */
/* Enqueue                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Enqueue a durable inbox notification for `input.userId`. The single write
 * point for mentions / assignments / SLA breaches / approvals.
 *
 * Best-effort: returns the created notification on success, or `null` on any
 * failure (missing fields, self-notification, downed DB) WITHOUT throwing — a
 * caller firing this inline from a record mutation must never be broken by it.
 *
 * Derives `title` / `body` / `href` from the pure builders when the caller omits
 * them, and skips obvious self-notifications (`userId === actorId`).
 */
export async function notify(
  input: NotifyInput,
): Promise<SabcrmInboxNotification | null> {
  try {
    if (!input?.projectId || !input?.userId) return null;
    if (!isNotificationKind(input.kind)) return null;
    // Don't notify someone about their own action.
    if (input.actorId && input.actorId === input.userId) return null;

    const target = sanitizeTarget(input.target);
    const normalized: NotifyInput = { ...input, target };

    const now = new Date();
    const doc: Record<string, unknown> = {
      projectId: input.projectId,
      userId: input.userId,
      kind: input.kind,
      title: buildTitle(normalized),
      read: false,
      createdAt: now,
    };
    const body = buildBody(normalized);
    if (body) doc.body = body;
    const href = buildHref(normalized);
    if (href) doc.href = href;
    if (target) doc.target = target;
    if (input.actorId) doc.actorId = input.actorId;
    if (input.actorName?.trim()) doc.actorName = input.actorName.trim();

    const { db } = await connectToDatabase();
    const res = await db.collection(COLL).insertOne(doc);
    return toNotification({
      ...(doc as unknown as NotificationDoc),
      _id: res.insertedId,
    });
  } catch {
    return null; // best-effort: never throw
  }
}

/**
 * Fan one notification out to many recipients (e.g. every mentioned member).
 * De-dupes the recipient list and skips the actor. Returns how many were
 * enqueued. Best-effort.
 */
export async function notifyMany(
  base: Omit<NotifyInput, 'userId'>,
  userIds: string[],
): Promise<number> {
  const seen = new Set<string>();
  let n = 0;
  for (const userId of userIds) {
    const id = typeof userId === 'string' ? userId.trim() : '';
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const created = await notify({ ...base, userId: id });
    if (created) n += 1;
  }
  return n;
}

/* -------------------------------------------------------------------------- */
/* Read                                                                        */
/* -------------------------------------------------------------------------- */

export interface ListNotificationsOpts {
  /** When true, only unread rows are returned. */
  unreadOnly?: boolean;
  /** Page size (1..=100). Defaults to 30. */
  limit?: number;
  /** Zero-based offset into the result set. Defaults to 0. */
  skip?: number;
}

/**
 * List a user's notifications within a project, newest first. Always scoped to
 * `{ userId, projectId }` — a member can only ever read their own inbox.
 */
export async function listNotifications(
  projectId: string,
  userId: string,
  opts: ListNotificationsOpts = {},
): Promise<SabcrmInboxNotification[]> {
  if (!projectId || !userId) return [];
  const limit = Math.min(MAX_PAGE, Math.max(1, opts.limit ?? DEFAULT_PAGE));
  const skip = Math.max(0, opts.skip ?? 0);
  const filter: Filter<NotificationDoc> = { projectId, userId };
  if (opts.unreadOnly) filter.read = { $ne: true };

  const { db } = await connectToDatabase();
  const docs = (await db
    .collection(COLL)
    .find(filter as Filter<Record<string, unknown>>)
    .sort({ createdAt: -1, _id: -1 })
    .skip(skip)
    .limit(limit)
    .toArray()) as unknown as NotificationDoc[];
  return docs.map(toNotification);
}

/** The user's unread notification count within a project. */
export async function unreadCount(
  projectId: string,
  userId: string,
): Promise<number> {
  if (!projectId || !userId) return 0;
  const { db } = await connectToDatabase();
  return db.collection(COLL).countDocuments({
    projectId,
    userId,
    read: { $ne: true },
  } as Filter<Record<string, unknown>>);
}

/* -------------------------------------------------------------------------- */
/* Write                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Mark one notification read (or unread). Matched by `{ _id, projectId, userId }`
 * so a user can never flip another user's (or another tenant's) row. Returns
 * `true` only when a document was modified.
 */
export async function markRead(
  projectId: string,
  userId: string,
  id: string,
  read = true,
): Promise<boolean> {
  if (!projectId || !userId || !ObjectId.isValid(id)) return false;
  const { db } = await connectToDatabase();
  const res = await db.collection(COLL).updateOne(
    { _id: new ObjectId(id), projectId, userId } as Filter<Record<string, unknown>>,
    { $set: { read } },
  );
  return res.modifiedCount > 0;
}

/**
 * Mark every unread notification for the user (within the project) as read.
 * Scoped to `{ projectId, userId }`. Returns the number flipped.
 */
export async function markAllRead(
  projectId: string,
  userId: string,
): Promise<number> {
  if (!projectId || !userId) return 0;
  const { db } = await connectToDatabase();
  const res = await db.collection(COLL).updateMany(
    { projectId, userId, read: { $ne: true } } as Filter<Record<string, unknown>>,
    { $set: { read: true } },
  );
  return res.modifiedCount ?? 0;
}

/**
 * Delete one of the user's notifications. Matched by `{ _id, projectId, userId }`.
 * Returns `true` only when a document was removed.
 */
export async function deleteNotification(
  projectId: string,
  userId: string,
  id: string,
): Promise<boolean> {
  if (!projectId || !userId || !ObjectId.isValid(id)) return false;
  const { db } = await connectToDatabase();
  const res = await db.collection(COLL).deleteOne({
    _id: new ObjectId(id),
    projectId,
    userId,
  } as Filter<Record<string, unknown>>);
  return res.deletedCount > 0;
}
