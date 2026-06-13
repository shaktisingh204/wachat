import 'server-only';

/**
 * SabCRM — threaded record comments + @mentions runtime (server-only).
 *
 * Persists comments in `sabcrm_comments` (projectId + object + recordId scoped,
 * `parentId` for one-level threading) using the native-Mongo config pattern of
 * `./scoring.server.ts`. The pure parsing / rendering / threading math lives in
 * `./comments.ts` and is re-exported here so callers import only this file.
 *
 * ## Notification fan-out (mention → inbox)
 *
 * `addComment` resolves the body's `@[Name](user:ID)` tokens against the
 * project's workspace members (`listCrmMembers`) and ENQUEUES one notification
 * per mentioned member (minus the author) into the SAME `sabcrm_notifications`
 * collection the notification-inbox vertical's Rust engine reads. We write the
 * Mongo doc DIRECTLY (matching the Rust `create_notification` shape exactly —
 * `{ _id, projectId, userId, title, body, kind, actorId, read:false,
 * createdAt: rfc3339, … }`) rather than calling the Rust engine, so a mention
 * notification is delivered even when the Rust sidecar is down at dev time, and
 * the existing bell/inbox UI (`sabcrm-notifications.actions.ts`) lists it with
 * zero change. Fan-out is best-effort: a downed inbox must never fail the
 * comment write.
 *
 * Tenant safety: every read/write is scoped by `projectId`, and mutations match
 * `{ _id, projectId }` before touching a document so a tenant can never reach
 * another tenant's thread. This module never bumps any record's `updatedAt`
 * (comments are a sibling collection, not record data).
 */

import { ObjectId, type Db } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { listCrmMembers, type CrmMember } from './members.server';
import {
  parseMentions,
  commentPreview,
  nestComments,
  type AddCommentInput,
  type CrmComment,
  type CommentMention,
  type CommentMember,
  type CommentNode,
} from './comments';

export {
  parseMentions,
  mentionedUserIds,
  renderCommentHtml,
  escapeHtml,
  commentPreview,
  sortByCreatedAsc,
  nestComments,
  countComments,
  type AddCommentInput,
  type CrmComment,
  type CommentNode,
  type CommentMention,
  type CommentMember,
} from './comments';

const COMMENTS_COLL = 'sabcrm_comments';
/** The collection the notification-inbox vertical (Rust engine) reads. */
const NOTIFICATIONS_COLL = 'sabcrm_notifications';

/** Hard cap on comments returned for one record (newest threads matter most). */
const MAX_COMMENTS = 500;

/** Raw Mongo doc for a comment. */
interface CommentDoc {
  _id: ObjectId | string;
  projectId: string;
  object: string;
  recordId: string;
  parentId?: string | null;
  authorId: string;
  body: string;
  mentions?: CommentMention[];
  createdAt?: string;
  updatedAt?: string;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function idHex(id: ObjectId | string): string {
  return id instanceof ObjectId ? id.toHexString() : String(id);
}

/** Normalise a persisted doc into the serialisable {@link CrmComment} shape. */
function toComment(doc: CommentDoc): CrmComment {
  return {
    _id: idHex(doc._id),
    projectId: doc.projectId,
    object: doc.object,
    recordId: doc.recordId,
    parentId: doc.parentId ? String(doc.parentId) : null,
    authorId: doc.authorId,
    body: typeof doc.body === 'string' ? doc.body : '',
    mentions: Array.isArray(doc.mentions) ? doc.mentions : [],
    createdAt: doc.createdAt ?? '',
    updatedAt: doc.updatedAt ?? '',
  };
}

/** Member roster → the slim {@link CommentMember} the renderer/composer use. */
function toCommentMember(m: CrmMember): CommentMember {
  const member: CommentMember = { userId: m.userId, name: m.name || m.email };
  if (m.image) member.avatarUrl = m.image;
  return member;
}

/**
 * Best-effort, idempotent index creation for `sabcrm_comments`. Mirrors the
 * `ensureSabcrmIndexes` convention but local to this module so we never edit
 * the shared `./db.ts`. Swallows races/dupes.
 */
let indexesEnsured = false;
async function ensureCommentIndexes(db: Db): Promise<void> {
  if (indexesEnsured) return;
  try {
    await db.collection(COMMENTS_COLL).createIndexes([
      // The hot read: a record's thread, newest first.
      {
        key: { projectId: 1, object: 1, recordId: 1, createdAt: -1 },
        name: 'sabcrm_comments_record_thread',
      },
      // Reply lookups + cascade on parent.
      { key: { projectId: 1, parentId: 1 }, name: 'sabcrm_comments_parent' },
    ]);
    indexesEnsured = true;
  } catch {
    /* best-effort — a concurrent creator or existing index is fine */
  }
}

/* -------------------------------------------------------------------------- */
/* Reads                                                                       */
/* -------------------------------------------------------------------------- */

/** What `listComments` returns: the nested thread + the member roster. */
export interface CommentThread {
  /** Roots (oldest → newest), each with its one-level replies. */
  nodes: CommentNode[];
  /** Flat, time-ordered list (handy for counts / the panel's own nesting). */
  comments: CrmComment[];
  /** Workspace members for rendering mentions + the composer. */
  members: CommentMember[];
}

/**
 * List a record's comment thread (nested) plus the workspace member roster used
 * to render mentions and power the composer. Scoped to
 * `projectId + object + recordId`. Returns empty structures on bad input.
 */
export async function listComments(
  projectId: string,
  object: string,
  recordId: string,
): Promise<CommentThread> {
  if (!projectId || !object || !recordId) {
    return { nodes: [], comments: [], members: [] };
  }
  const { db } = await connectToDatabase();
  await ensureCommentIndexes(db);

  const [docs, roster] = await Promise.all([
    db
      .collection(COMMENTS_COLL)
      .find({ projectId, object, recordId })
      .sort({ createdAt: 1, _id: 1 })
      .limit(MAX_COMMENTS)
      .toArray() as unknown as Promise<CommentDoc[]>,
    listCrmMembers(projectId).catch(() => [] as CrmMember[]),
  ]);

  const comments = docs.map(toComment);
  return {
    nodes: nestComments(comments),
    comments,
    members: roster.map(toCommentMember),
  };
}

/** A single comment by id (tenant-scoped), or null. */
export async function getComment(
  projectId: string,
  id: string,
): Promise<CrmComment | null> {
  if (!projectId || !ObjectId.isValid(id)) return null;
  const { db } = await connectToDatabase();
  const doc = (await db
    .collection(COMMENTS_COLL)
    .findOne({ _id: new ObjectId(id), projectId })) as CommentDoc | null;
  return doc ? toComment(doc) : null;
}

/* -------------------------------------------------------------------------- */
/* Notification fan-out                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Enqueue one notification per mentioned member (excluding the author) into
 * `sabcrm_notifications`, matching the Rust `create_notification` doc shape so
 * the existing inbox lists them unchanged. Only members of the project receive
 * a row (a stray token id is ignored). Best-effort — never throws.
 *
 * @returns the user ids actually notified.
 */
async function enqueueMentionNotifications(args: {
  db: Db;
  projectId: string;
  object: string;
  recordId: string;
  authorId: string;
  authorName?: string;
  body: string;
  mentions: CommentMention[];
  memberIds: ReadonlySet<string>;
}): Promise<string[]> {
  const { db, projectId, object, recordId, authorId, authorName, body } = args;
  try {
    const targets = args.mentions
      .map((m) => m.userId)
      .filter((uid) => uid && uid !== authorId && args.memberIds.has(uid));
    if (targets.length === 0) return [];

    const nowIso = new Date().toISOString();
    const preview = commentPreview(body);
    const who = (authorName || 'Someone').trim();
    const docs = targets.map((userId) => {
      const doc: Record<string, unknown> = {
        _id: new ObjectId(),
        projectId,
        userId,
        title: `${who} mentioned you in a comment`,
        kind: 'mention',
        actorId: authorId,
        read: false,
        createdAt: nowIso,
        targetObject: object,
        targetRecordId: recordId,
      };
      if (preview) doc.body = preview;
      if (authorName) doc.actorName = authorName;
      return doc;
    });
    await db.collection(NOTIFICATIONS_COLL).insertMany(docs, { ordered: false });
    return targets;
  } catch {
    return []; // best-effort — a downed inbox never fails the comment
  }
}

/* -------------------------------------------------------------------------- */
/* Writes                                                                      */
/* -------------------------------------------------------------------------- */

/** Result of {@link addComment}: the saved comment + who got notified. */
export interface AddCommentResult {
  comment: CrmComment;
  /** User ids that received a mention notification. */
  notified: string[];
}

/**
 * Add a comment (root or reply) to a record. Resolves the body's mention tokens
 * against the workspace roster, snapshots them onto the doc, and enqueues a
 * mention notification per mentioned member (minus the author). A `parentId` is
 * honored only when it resolves to an existing comment on the SAME record
 * (otherwise the comment is stored as a root). Tenant-scoped by `projectId`.
 */
export async function addComment(
  projectId: string,
  authorId: string,
  input: AddCommentInput,
): Promise<AddCommentResult> {
  const body = (input.body ?? '').trim();
  if (!projectId || !authorId) throw new Error('Not authenticated.');
  if (!input.object || !input.recordId) {
    throw new Error('A target record is required.');
  }
  if (!body) throw new Error('A comment cannot be empty.');

  const { db } = await connectToDatabase();
  await ensureCommentIndexes(db);

  // Resolve members once: validates mention targets + snapshots the author name.
  const roster = await listCrmMembers(projectId).catch(() => [] as CrmMember[]);
  const memberIds = new Set(roster.map((m) => m.userId));
  const author = roster.find((m) => m.userId === authorId);
  const authorName = author ? author.name || author.email : undefined;

  // Snapshot mentions, keeping only those that are real project members.
  const mentions: CommentMention[] = parseMentions(body).filter((m) =>
    memberIds.has(m.userId),
  );

  // Validate parentId: must be an existing comment on this same record.
  let parentId: string | null = null;
  if (input.parentId && ObjectId.isValid(input.parentId)) {
    const parent = (await db.collection(COMMENTS_COLL).findOne({
      _id: new ObjectId(input.parentId),
      projectId,
      object: input.object,
      recordId: input.recordId,
    })) as CommentDoc | null;
    if (parent) parentId = idHex(parent._id);
  }

  const nowIso = new Date().toISOString();
  const doc: CommentDoc = {
    _id: new ObjectId(),
    projectId,
    object: input.object,
    recordId: input.recordId,
    parentId,
    authorId,
    body,
    mentions,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  await db
    .collection(COMMENTS_COLL)
    .insertOne(doc as unknown as Record<string, unknown>);

  const notified = await enqueueMentionNotifications({
    db,
    projectId,
    object: input.object,
    recordId: input.recordId,
    authorId,
    authorName,
    body,
    mentions,
    memberIds,
  });

  return { comment: toComment(doc), notified };
}

/**
 * Delete a comment by id (tenant-scoped). When the comment is a ROOT, its
 * direct replies are deleted too so the thread never orphans. Only the author
 * may delete their own comment — the action layer additionally enforces the
 * `edit` RBAC gate; this function enforces authorship. Returns the number of
 * comments removed (0 when nothing matched / not the author).
 */
export async function deleteComment(
  projectId: string,
  authorId: string,
  id: string,
): Promise<number> {
  if (!projectId || !authorId || !ObjectId.isValid(id)) return 0;
  const { db } = await connectToDatabase();

  const target = (await db.collection(COMMENTS_COLL).findOne({
    _id: new ObjectId(id),
    projectId,
  })) as CommentDoc | null;
  if (!target || target.authorId !== authorId) return 0;

  let removed = 0;
  // Cascade replies when deleting a root comment.
  if (!target.parentId) {
    const res = await db.collection(COMMENTS_COLL).deleteMany({
      projectId,
      parentId: idHex(target._id),
    });
    removed += res.deletedCount ?? 0;
  }
  const main = await db
    .collection(COMMENTS_COLL)
    .deleteOne({ _id: new ObjectId(id), projectId });
  removed += main.deletedCount ?? 0;
  return removed;
}

/**
 * Cascade-delete every comment attached to a record. Called when the parent
 * record itself is deleted so comments never orphan. Tenant-scoped; returns the
 * number removed. Best-effort (no throw on a downed DB).
 */
export async function deleteCommentsForRecord(
  projectId: string,
  object: string,
  recordId: string,
): Promise<number> {
  if (!projectId || !object || !recordId) return 0;
  try {
    const { db } = await connectToDatabase();
    const res = await db
      .collection(COMMENTS_COLL)
      .deleteMany({ projectId, object, recordId });
    return res.deletedCount ?? 0;
  } catch {
    return 0;
  }
}

/** Projects that have at least one comment (for any future sweep/backstop). */
export async function listProjectsWithComments(db: Db): Promise<string[]> {
  try {
    const ids = (await db
      .collection(COMMENTS_COLL)
      .distinct('projectId')) as string[];
    return ids.filter(Boolean);
  } catch {
    return [];
  }
}
