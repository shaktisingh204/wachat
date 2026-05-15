/**
 * Repository for the `sabwa_chats` collection.
 *
 * Mirrors the shape declared in `src/lib/sabwa/types.ts::SabwaChat`. Every
 * row is scoped per `(projectId, sessionId)`, keyed by the WhatsApp `jid`.
 *
 * This module is consumed by:
 *   - `routes/chats.ts` — read/list + metadata PATCHes.
 *   - The Baileys event bridge (`chats.upsert` / `chats.update`) — feeds
 *     fresh chats here whenever Baileys streams them.
 *   - `routes/messages.ts` — bumps `lastMessage` + `unreadCount` on send.
 */

import {
  ObjectId,
  type Collection,
  type Db,
  type Filter,
  type WithId,
} from 'mongodb';
import type {
  SabwaChat,
  SabwaChatLastMessage,
  SabwaChatType,
} from './types-shim.js';

const COLLECTION = 'sabwa_chats';

/** Shape returned over the wire to Next.js. JSON-friendly (no ObjectId / Date). */
export interface ChatRow {
  _id: string;
  projectId: string;
  sessionId: string;
  jid: string;
  type: SabwaChatType;
  name?: string;
  profilePicUrl?: string;
  lastMessage?: {
    id: string;
    body: string;
    ts: string;
    fromMe: boolean;
  };
  unreadCount: number;
  pinned: boolean;
  archived: boolean;
  muted: boolean;
  muteEndAt?: string;
  labels: string[];
  isReadOnly?: boolean;
  participants?: number;
  updatedAt: string;
}

export interface ChatListFilter {
  type?: SabwaChatType;
  query?: string;
  unreadOnly?: boolean;
  archivedOnly?: boolean;
  labelId?: string;
  limit?: number;
  cursor?: string;
}

export interface ChatUpsertInput {
  projectId: ObjectId | string;
  sessionId: ObjectId | string;
  jid: string;
  type?: SabwaChatType;
  name?: string;
  profilePicUrl?: string;
  lastMessage?: SabwaChatLastMessage;
  unreadCount?: number;
  isReadOnly?: boolean;
  participants?: number;
}

/** Resolve a string or ObjectId-like into a guaranteed `ObjectId`. */
function toObjectId(value: ObjectId | string): ObjectId {
  return typeof value === 'string' ? new ObjectId(value) : value;
}

/** Guess the chat type from the jid suffix when callers don't pass one. */
function inferChatType(jid: string): SabwaChatType {
  if (jid.endsWith('@g.us')) return 'group';
  if (jid.endsWith('@broadcast')) return 'broadcast';
  if (jid === 'status@broadcast') return 'status';
  return 'individual';
}

/** Render a Mongo doc into a wire-friendly `ChatRow`. */
function toRow(doc: WithId<SabwaChat>): ChatRow {
  return {
    _id: doc._id.toHexString(),
    projectId: doc.projectId.toHexString(),
    sessionId: doc.sessionId.toHexString(),
    jid: doc.jid,
    type: doc.type,
    name: doc.name,
    profilePicUrl: doc.profilePicUrl,
    lastMessage: doc.lastMessage
      ? {
          id: doc.lastMessage.id,
          body: doc.lastMessage.body,
          ts: doc.lastMessage.ts.toISOString(),
          fromMe: doc.lastMessage.fromMe,
        }
      : undefined,
    unreadCount: doc.unreadCount ?? 0,
    pinned: !!doc.pinned,
    archived: !!doc.archived,
    muted: !!doc.muted,
    muteEndAt: doc.muteEndAt?.toISOString(),
    labels: (doc.labels ?? []).map((l) => l.toHexString()),
    isReadOnly: doc.isReadOnly,
    participants: doc.participants,
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export class ChatsRepo {
  private readonly col: Collection<SabwaChat>;

  constructor(db: Db) {
    this.col = db.collection<SabwaChat>(COLLECTION);
  }

  /** Ensure the indexes we rely on for listing / dedup. Safe to call repeatedly. */
  async ensureIndexes(): Promise<void> {
    await this.col.createIndexes([
      { key: { sessionId: 1, jid: 1 }, unique: true, name: 'sessionId_jid_unique' },
      { key: { sessionId: 1, archived: 1, updatedAt: -1 }, name: 'session_archived_updated' },
      { key: { sessionId: 1, type: 1, updatedAt: -1 }, name: 'session_type_updated' },
    ]);
  }

  /**
   * Upsert a chat from a Baileys event. Returns the merged row. Increments
   * `unreadCount` when the incoming message is not from the session owner.
   */
  async upsert(input: ChatUpsertInput): Promise<ChatRow> {
    const now = new Date();
    const projectId = toObjectId(input.projectId);
    const sessionId = toObjectId(input.sessionId);
    const type = input.type ?? inferChatType(input.jid);

    const inc: Partial<Record<keyof SabwaChat, number>> = {};
    if (input.unreadCount && input.unreadCount > 0) {
      inc.unreadCount = input.unreadCount;
    }

    // Mongo rejects ($setOnInsert + $inc) on the same path with code 40, even
    // though they can't logically collide. When we're incrementing unreadCount,
    // let $inc seed the field on insert; otherwise default it to 0 here.
    const setOnInsert: Partial<SabwaChat> & { _id: ObjectId } = {
      _id: new ObjectId(),
      projectId,
      sessionId,
      jid: input.jid,
      type,
      pinned: false,
      archived: false,
      muted: false,
      labels: [],
    };
    if (inc.unreadCount === undefined) setOnInsert.unreadCount = 0;

    const set: Partial<SabwaChat> = { updatedAt: now };
    if (input.name !== undefined) set.name = input.name;
    if (input.profilePicUrl !== undefined) set.profilePicUrl = input.profilePicUrl;
    if (input.isReadOnly !== undefined) set.isReadOnly = input.isReadOnly;
    if (input.participants !== undefined) set.participants = input.participants;
    if (input.lastMessage !== undefined) set.lastMessage = input.lastMessage;

    const updateOps: Record<string, unknown> = { $set: set, $setOnInsert: setOnInsert };
    if (Object.keys(inc).length > 0) updateOps.$inc = inc;

    const result = await this.col.findOneAndUpdate(
      { sessionId, jid: input.jid },
      updateOps,
      { upsert: true, returnDocument: 'after' },
    );

    // `result` may be the raw doc (driver v6) or wrapped `{ value }` (older).
    const doc = (result && 'value' in (result as object)
      ? (result as unknown as { value: WithId<SabwaChat> | null }).value
      : (result as WithId<SabwaChat> | null)) ?? null;

    if (!doc) {
      // Fallback re-read — upsert shouldn't return null but be defensive.
      const refetched = await this.col.findOne({ sessionId, jid: input.jid });
      if (!refetched) throw new Error('chats.upsert returned no document');
      return toRow(refetched);
    }
    return toRow(doc);
  }

  /**
   * List chats for a session, optionally filtered/paginated.
   *
   * Coalesces `name` / `profilePicUrl` against `sabwa_contacts` via $lookup
   * so chats with no metadata of their own still show a display name and
   * avatar once the contact has been learned (history sync, contacts.upsert
   * event, or a manual contact upsert from the route).
   */
  async list(sessionId: ObjectId | string, filter: ChatListFilter = {}): Promise<{
    chats: ChatRow[];
    nextCursor?: string;
  }> {
    const sid = toObjectId(sessionId);
    const q: Filter<SabwaChat> = { sessionId: sid };
    if (filter.type) q.type = filter.type;
    if (filter.unreadOnly) q.unreadCount = { $gt: 0 };
    q.archived = filter.archivedOnly ? true : { $ne: true };
    if (filter.labelId) {
      try {
        q.labels = new ObjectId(filter.labelId);
      } catch {
        /* ignore invalid label id — yield empty */
        return { chats: [] };
      }
    }

    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);

    let cursorTs: Date | undefined;
    if (filter.cursor) {
      try {
        const decoded = Buffer.from(filter.cursor, 'base64').toString('utf8');
        const ts = Number.parseInt(decoded, 10);
        if (Number.isFinite(ts)) cursorTs = new Date(ts);
      } catch {
        /* ignore invalid cursor */
      }
    }
    if (cursorTs) q.updatedAt = { $lt: cursorTs };

    const textRx = filter.query
      ? new RegExp(filter.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      : undefined;

    const pipeline: Record<string, unknown>[] = [
      { $match: q },
      {
        $lookup: {
          from: 'sabwa_contacts',
          let: { sid: '$sessionId', j: '$jid' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$sessionId', '$$sid'] },
                    { $eq: ['$jid', '$$j'] },
                  ],
                },
              },
            },
            { $limit: 1 },
            { $project: { _id: 0, name: 1, pushName: 1, profilePicUrl: 1 } },
          ],
          as: '_contact',
        },
      },
      {
        $addFields: {
          name: {
            $ifNull: [
              '$name',
              {
                $ifNull: [
                  { $arrayElemAt: ['$_contact.name', 0] },
                  { $arrayElemAt: ['$_contact.pushName', 0] },
                ],
              },
            ],
          },
          profilePicUrl: {
            $ifNull: ['$profilePicUrl', { $arrayElemAt: ['$_contact.profilePicUrl', 0] }],
          },
        },
      },
    ];

    if (textRx) {
      pipeline.push({ $match: { $or: [{ name: textRx }, { jid: textRx }] } });
    }

    pipeline.push({ $sort: { pinned: -1, updatedAt: -1 } });
    pipeline.push({ $limit: limit + 1 });
    pipeline.push({ $project: { _contact: 0 } });

    const docs = (await this.col.aggregate(pipeline).toArray()) as WithId<SabwaChat>[];

    let nextCursor: string | undefined;
    if (docs.length > limit) {
      const last = docs[limit - 1];
      if (last) {
        nextCursor = Buffer.from(String(last.updatedAt.getTime()), 'utf8').toString('base64');
      }
      docs.length = limit;
    }

    return { chats: docs.map(toRow), nextCursor };
  }

  /** Patch a chat's profilePicUrl. No-op if the chat row doesn't exist. */
  async setProfilePic(
    sessionId: ObjectId | string,
    jid: string,
    profilePicUrl: string,
  ): Promise<void> {
    await this.col.updateOne(
      { sessionId: toObjectId(sessionId), jid },
      { $set: { profilePicUrl, updatedAt: new Date() } },
    );
  }

  async setPinned(
    sessionId: ObjectId | string,
    jid: string,
    pinned: boolean,
  ): Promise<void> {
    await this.col.updateOne(
      { sessionId: toObjectId(sessionId), jid },
      { $set: { pinned, updatedAt: new Date() } },
    );
  }

  async setMuted(
    sessionId: ObjectId | string,
    jid: string,
    muted: boolean,
    muteForSec?: number | null,
  ): Promise<void> {
    const set: Partial<SabwaChat> = { muted, updatedAt: new Date() };
    if (muted && muteForSec && muteForSec > 0) {
      set.muteEndAt = new Date(Date.now() + muteForSec * 1000);
    }
    const unset = !muted ? { muteEndAt: '' } : undefined;
    const op: Record<string, unknown> = { $set: set };
    if (unset) op.$unset = unset;
    await this.col.updateOne({ sessionId: toObjectId(sessionId), jid }, op);
  }

  async setArchived(
    sessionId: ObjectId | string,
    jid: string,
    archived: boolean,
  ): Promise<void> {
    await this.col.updateOne(
      { sessionId: toObjectId(sessionId), jid },
      { $set: { archived, updatedAt: new Date() } },
    );
  }

  async setLabels(
    sessionId: ObjectId | string,
    jid: string,
    labelIds: string[],
  ): Promise<void> {
    const labels: ObjectId[] = [];
    for (const l of labelIds) {
      try {
        labels.push(new ObjectId(l));
      } catch {
        /* skip invalid */
      }
    }
    await this.col.updateOne(
      { sessionId: toObjectId(sessionId), jid },
      { $set: { labels, updatedAt: new Date() } },
    );
  }

  /** Reset `unreadCount` to 0 — used when a chat is marked read. */
  async markRead(sessionId: ObjectId | string, jid: string): Promise<void> {
    await this.col.updateOne(
      { sessionId: toObjectId(sessionId), jid },
      { $set: { unreadCount: 0, updatedAt: new Date() } },
    );
  }
}

export { toRow as chatToRow };
