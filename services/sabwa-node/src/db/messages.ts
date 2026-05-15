/**
 * Repository for the `sabwa_messages` collection.
 *
 * Mirrors the shape declared in `src/lib/sabwa/types.ts::SabwaMessage`. Rows
 * are scoped per `(projectId, sessionId, chatJid)` and uniquely identified by
 * the WhatsApp `messageId`.
 *
 * This module is consumed by:
 *   - `routes/messages.ts` — list/send/mutate.
 *   - The Baileys `messages.upsert` event bridge — persists every inbound
 *     message via `upsertByMessageId`.
 */

import {
  ObjectId,
  type Collection,
  type Db,
  type Filter,
  type WithId,
} from 'mongodb';
import type {
  SabwaMessage,
  SabwaMessageStatus,
  SabwaMessageType,
  SabwaReaction,
} from './types-shim.js';

const COLLECTION = 'sabwa_messages';
const DEFAULT_PAGE = 50;
const MAX_PAGE = 200;

/** Wire-friendly variant returned to Next.js (no ObjectId / Date). */
export interface MessageRow {
  _id: string;
  projectId: string;
  sessionId: string;
  chatJid: string;
  messageId: string;
  fromJid: string;
  fromMe: boolean;
  type: SabwaMessageType;
  body?: string;
  mediaUrl?: string;
  mediaMime?: string;
  mediaSize?: number;
  caption?: string;
  quotedMessageId?: string;
  reactions: { jid: string; emoji: string; ts: string }[];
  status: SabwaMessageStatus;
  forwarded?: boolean;
  starred?: boolean;
  ts: string;
  editedAt?: string;
  deletedAt?: string;
}

export interface MessageUpsertInput {
  projectId: ObjectId | string;
  sessionId: ObjectId | string;
  chatJid: string;
  messageId: string;
  fromJid: string;
  fromMe: boolean;
  type: SabwaMessageType;
  body?: string;
  mediaUrl?: string;
  mediaMime?: string;
  mediaSize?: number;
  caption?: string;
  quotedMessageId?: string;
  status?: SabwaMessageStatus;
  forwarded?: boolean;
  ts?: Date | number;
}

function toObjectId(value: ObjectId | string): ObjectId {
  return typeof value === 'string' ? new ObjectId(value) : value;
}

function reactionToWire(r: SabwaReaction): MessageRow['reactions'][number] {
  return { jid: r.jid, emoji: r.emoji, ts: r.ts.toISOString() };
}

function toRow(doc: WithId<SabwaMessage>): MessageRow {
  return {
    _id: doc._id.toHexString(),
    projectId: doc.projectId.toHexString(),
    sessionId: doc.sessionId.toHexString(),
    chatJid: doc.chatJid,
    messageId: doc.messageId,
    fromJid: doc.fromJid,
    fromMe: doc.fromMe,
    type: doc.type,
    body: doc.body,
    mediaUrl: doc.mediaUrl,
    mediaMime: doc.mediaMime,
    mediaSize: doc.mediaSize,
    caption: doc.caption,
    quotedMessageId: doc.quotedMessageId,
    reactions: (doc.reactions ?? []).map(reactionToWire),
    status: doc.status,
    forwarded: doc.forwarded,
    starred: doc.starred,
    ts: doc.ts.toISOString(),
    editedAt: doc.editedAt?.toISOString(),
    deletedAt: doc.deletedAt?.toISOString(),
  };
}

export class MessagesRepo {
  private readonly col: Collection<SabwaMessage>;

  constructor(db: Db) {
    this.col = db.collection<SabwaMessage>(COLLECTION);
  }

  async ensureIndexes(): Promise<void> {
    await this.col.createIndexes([
      {
        key: { sessionId: 1, messageId: 1 },
        unique: true,
        name: 'sessionId_messageId_unique',
      },
      {
        key: { sessionId: 1, chatJid: 1, ts: -1 },
        name: 'session_chat_ts',
      },
      { key: { sessionId: 1, starred: 1, ts: -1 }, name: 'session_starred_ts', sparse: true },
    ]);
  }

  /**
   * Idempotently persist a message. Used by both the Baileys ingress event
   * bridge and the outbound send path (sent messages also flow through here
   * so the inbox sees them immediately).
   */
  async upsertByMessageId(input: MessageUpsertInput): Promise<MessageRow> {
    const projectId = toObjectId(input.projectId);
    const sessionId = toObjectId(input.sessionId);
    const ts =
      input.ts instanceof Date
        ? input.ts
        : typeof input.ts === 'number'
          ? new Date(input.ts)
          : new Date();

    const set: Partial<SabwaMessage> = {
      type: input.type,
      fromJid: input.fromJid,
      fromMe: input.fromMe,
      status: input.status ?? (input.fromMe ? 'sent' : 'delivered'),
      ts,
    };
    if (input.body !== undefined) set.body = input.body;
    if (input.mediaUrl !== undefined) set.mediaUrl = input.mediaUrl;
    if (input.mediaMime !== undefined) set.mediaMime = input.mediaMime;
    if (input.mediaSize !== undefined) set.mediaSize = input.mediaSize;
    if (input.caption !== undefined) set.caption = input.caption;
    if (input.quotedMessageId !== undefined) set.quotedMessageId = input.quotedMessageId;
    if (input.forwarded !== undefined) set.forwarded = input.forwarded;

    const setOnInsert = {
      _id: new ObjectId(),
      projectId,
      sessionId,
      chatJid: input.chatJid,
      messageId: input.messageId,
      reactions: [] as SabwaReaction[],
    } satisfies Partial<SabwaMessage> & { _id: ObjectId };

    const result = await this.col.findOneAndUpdate(
      { sessionId, messageId: input.messageId },
      { $set: set, $setOnInsert: setOnInsert },
      { upsert: true, returnDocument: 'after' },
    );

    const doc = (result && 'value' in (result as object)
      ? (result as unknown as { value: WithId<SabwaMessage> | null }).value
      : (result as WithId<SabwaMessage> | null)) ?? null;

    if (!doc) {
      const refetched = await this.col.findOne({ sessionId, messageId: input.messageId });
      if (!refetched) throw new Error('messages.upsert returned no document');
      return toRow(refetched);
    }
    return toRow(doc);
  }

  /** Page through messages for a chat, newest-first. Cursor encodes the last `ts`. */
  async list(
    sessionId: ObjectId | string,
    chatJid: string,
    cursor?: string,
    limit?: number,
  ): Promise<{ messages: MessageRow[]; nextCursor?: string }> {
    const sid = toObjectId(sessionId);
    const cap = Math.min(Math.max(limit ?? DEFAULT_PAGE, 1), MAX_PAGE);

    const q: Filter<SabwaMessage> = { sessionId: sid, chatJid };
    if (cursor) {
      try {
        const decoded = Buffer.from(cursor, 'base64').toString('utf8');
        const ts = Number.parseInt(decoded, 10);
        if (Number.isFinite(ts)) q.ts = { $lt: new Date(ts) };
      } catch {
        /* ignore */
      }
    }

    const docs = await this.col
      .find(q)
      .sort({ ts: -1 })
      .limit(cap + 1)
      .toArray();

    let nextCursor: string | undefined;
    if (docs.length > cap) {
      const last = docs[cap - 1];
      if (last) {
        nextCursor = Buffer.from(String(last.ts.getTime()), 'utf8').toString('base64');
      }
      docs.length = cap;
    }

    // Return chronological (oldest-first) — the UI scrolls top-to-bottom.
    return { messages: docs.reverse().map(toRow), nextCursor };
  }

  async updateStatus(
    sessionId: ObjectId | string,
    messageId: string,
    status: SabwaMessageStatus,
  ): Promise<void> {
    await this.col.updateOne(
      { sessionId: toObjectId(sessionId), messageId },
      { $set: { status } },
    );
  }

  async setStarred(
    sessionId: ObjectId | string,
    messageId: string,
    starred: boolean,
  ): Promise<void> {
    await this.col.updateOne(
      { sessionId: toObjectId(sessionId), messageId },
      { $set: { starred } },
    );
  }

  async softDelete(
    sessionId: ObjectId | string,
    messageId: string,
  ): Promise<void> {
    await this.col.updateOne(
      { sessionId: toObjectId(sessionId), messageId },
      { $set: { deletedAt: new Date() } },
    );
  }
}

export { toRow as messageToRow };
