/**
 * `sabwa_broadcasts` repository.
 *
 * Broadcast lists are simple recipient bundles you can spray a payload over
 * — each recipient receives the message as a normal 1:1 chat (we do NOT use
 * WhatsApp's native multicast because that requires every contact to have us
 * in their address book). The send action fans the payload out onto the
 * session's outbound queue.
 *
 * Document shape (camelCase, matches `SabwaBroadcast` in
 * `src/lib/sabwa/types.ts` — minus the heavy per-recipient progress array,
 * which we omit until the bulk worker writes it):
 *
 *   {
 *     _id:        string                // "bc_<uuid>"
 *     projectId?: string                // optional — set on first create
 *     sessionId:  string
 *     name:       string
 *     recipients: string[]              // jids
 *     status:     SabwaBroadcastStatus  // 'draft' on create, mutated by send
 *     totalCount: number
 *     sentCount:  number
 *     failedCount: number
 *     lastSentAt?: Date
 *     createdAt:  Date
 *     updatedAt:  Date
 *   }
 */

import { type Db, type Collection } from 'mongodb';

export const COLLECTION = 'sabwa_broadcasts';

export type BroadcastStatus =
  | 'draft'
  | 'queued'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'aborted';

export interface BroadcastDoc {
  _id: string;
  projectId?: string;
  sessionId: string;
  name: string;
  recipients: string[];
  status: BroadcastStatus;
  totalCount: number;
  sentCount: number;
  failedCount: number;
  lastSentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface BroadcastWire {
  _id: string;
  sessionId: string;
  name: string;
  status: BroadcastStatus;
  recipients: { jid: string; status: string }[];
  totalCount: number;
  sentCount: number;
  failedCount: number;
  createdAt: Date;
  updatedAt: Date;
}

function collection(db: Db): Collection<BroadcastDoc> {
  return db.collection<BroadcastDoc>(COLLECTION);
}

/** Convert a stored doc into the wire shape Next.js consumes. */
export function toWire(doc: BroadcastDoc): BroadcastWire {
  return {
    _id: doc._id,
    sessionId: doc.sessionId,
    name: doc.name,
    status: doc.status ?? 'draft',
    recipients: (doc.recipients ?? []).map((jid) => ({ jid, status: 'queued' })),
    totalCount: doc.totalCount ?? doc.recipients?.length ?? 0,
    sentCount: doc.sentCount ?? 0,
    failedCount: doc.failedCount ?? 0,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export async function listBySession(db: Db, sessionId: string): Promise<BroadcastDoc[]> {
  return collection(db).find({ sessionId }).sort({ createdAt: -1 }).toArray();
}

export async function findById(db: Db, id: string): Promise<BroadcastDoc | null> {
  return collection(db).findOne({ _id: id });
}

/**
 * Upsert helper. If `id` is provided we patch the existing row; otherwise we
 * create a new one keyed by `bc_<crypto.randomUUID()>`.
 */
export async function upsert(
  db: Db,
  input: {
    id?: string;
    projectId?: string;
    sessionId: string;
    name: string;
    recipients: string[];
  },
): Promise<{ id: string; created: boolean }> {
  const col = collection(db);
  const now = new Date();

  if (input.id) {
    const existing = await col.findOne({ _id: input.id });
    if (!existing) {
      // Treat "update unknown id" as an insert with that id — keeps the API
      // idempotent for the Next.js upsert action.
      await col.insertOne({
        _id: input.id,
        projectId: input.projectId,
        sessionId: input.sessionId,
        name: input.name,
        recipients: input.recipients,
        status: 'draft',
        totalCount: input.recipients.length,
        sentCount: 0,
        failedCount: 0,
        createdAt: now,
        updatedAt: now,
      });
      return { id: input.id, created: true };
    }
    await col.updateOne(
      { _id: input.id },
      {
        $set: {
          name: input.name,
          recipients: input.recipients,
          totalCount: input.recipients.length,
          updatedAt: now,
        },
      },
    );
    return { id: input.id, created: false };
  }

  const id = `bc_${cryptoRandomId()}`;
  await col.insertOne({
    _id: id,
    projectId: input.projectId,
    sessionId: input.sessionId,
    name: input.name,
    recipients: input.recipients,
    status: 'draft',
    totalCount: input.recipients.length,
    sentCount: 0,
    failedCount: 0,
    createdAt: now,
    updatedAt: now,
  });
  return { id, created: true };
}

export async function deleteById(db: Db, id: string): Promise<boolean> {
  const res = await collection(db).deleteOne({ _id: id });
  return res.deletedCount === 1;
}

export async function markSent(db: Db, id: string, sentDelta: number, failedDelta: number): Promise<void> {
  await collection(db).updateOne(
    { _id: id },
    {
      $set: { lastSentAt: new Date(), updatedAt: new Date() },
      $inc: { sentCount: sentDelta, failedCount: failedDelta },
    },
  );
}

export async function setStatus(db: Db, id: string, status: BroadcastStatus): Promise<void> {
  await collection(db).updateOne(
    { _id: id },
    { $set: { status, updatedAt: new Date() } },
  );
}

/** Standalone wrapper so the test surface doesn't drag in node:crypto unless needed. */
function cryptoRandomId(): string {
  // `globalThis.crypto.randomUUID` is available on Node 20+.
  return globalThis.crypto.randomUUID();
}
