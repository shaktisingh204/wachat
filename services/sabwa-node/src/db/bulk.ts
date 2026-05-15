/**
 * `sabwa_bulk_campaigns` + `sabwa_bulk_recipients` repository.
 *
 * Two collections power the bulk sender:
 *
 *   - `sabwa_bulk_campaigns` — parent row, one per campaign. Tracks status,
 *     progress counters, pacing knobs, and the payload template.
 *   - `sabwa_bulk_recipients` — child rows, one per (campaign, jid). Holds
 *     per-recipient delivery state so the UI can render a progress grid.
 *
 * Document shape (camelCase):
 *
 *   campaign:
 *     {
 *       _id:        string                 // "camp_<uuid>"
 *       projectId?: string
 *       sessionId:  string
 *       name:       string
 *       status:     CampaignStatus
 *       payload:    SabwaScheduledPayload  // template before personalisation
 *       sendRate:   number                 // msgs/min target
 *       jitter:     number                 // seconds, +/- per recipient
 *       totalCount: number
 *       sentCount:  number
 *       failedCount: number
 *       cancelledCount: number
 *       consecutiveErrors: number
 *       pausedUntilUtcDay?: string
 *       startedAt?:  Date
 *       finishedAt?: Date
 *       createdAt:   Date
 *       updatedAt:   Date
 *     }
 *
 *   recipient:
 *     {
 *       _id:         `${campaignId}:${jid}`
 *       campaignId:  string
 *       sessionId:   string
 *       jid:         string
 *       order:       number
 *       status:      RecipientStatus
 *       error?:      string
 *       sentAt?:     Date
 *       updatedAt:   Date
 *     }
 */

import { type Db, type Collection } from 'mongodb';

export const CAMPAIGNS_COLLECTION = 'sabwa_bulk_campaigns';
export const RECIPIENTS_COLLECTION = 'sabwa_bulk_recipients';

export type CampaignStatus =
  | 'queued'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'aborted';

export type RecipientStatus =
  | 'pending'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed'
  | 'cancelled';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type JsonValue = any;

export interface CampaignDoc {
  _id: string;
  projectId?: string;
  sessionId: string;
  name: string;
  status: CampaignStatus;
  payload: JsonValue;
  recipients: string[]; // canonical jid list, kept for quick re-seed
  sendRate?: number;
  jitter?: number;
  totalCount: number;
  sentCount: number;
  failedCount: number;
  cancelledCount: number;
  consecutiveErrors: number;
  pausedUntilUtcDay?: string;
  startedAt?: Date;
  finishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecipientDoc {
  _id: string;
  campaignId: string;
  sessionId: string;
  jid: string;
  order: number;
  status: RecipientStatus;
  error?: string;
  sentAt?: Date;
  updatedAt: Date;
}

function campaignsCollection(db: Db): Collection<CampaignDoc> {
  return db.collection<CampaignDoc>(CAMPAIGNS_COLLECTION);
}

function recipientsCollection(db: Db): Collection<RecipientDoc> {
  return db.collection<RecipientDoc>(RECIPIENTS_COLLECTION);
}

/**
 * Wire shape returned to Next.js. Matches the `SabwaBroadcast`-flavoured shape
 * the existing `listBulkCampaigns` / `getBulkCampaign` actions consume so we
 * can share the same chart components across broadcasts and bulk.
 */
export interface CampaignWire {
  _id: string;
  sessionId: string;
  name: string;
  status: CampaignStatus;
  payload: JsonValue;
  perMinute?: number;
  jitterSec?: number;
  totalCount: number;
  sentCount: number;
  failedCount: number;
  recipients: { jid: string; status: RecipientStatus; error?: string; sentAt?: Date }[];
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export async function listBySession(db: Db, sessionId: string): Promise<CampaignDoc[]> {
  return campaignsCollection(db).find({ sessionId }).sort({ createdAt: -1 }).toArray();
}

export async function findById(db: Db, id: string): Promise<CampaignDoc | null> {
  return campaignsCollection(db).findOne({ _id: id });
}

export async function findActive(db: Db): Promise<CampaignDoc[]> {
  return campaignsCollection(db)
    .find({ status: { $in: ['queued', 'running'] } })
    .toArray();
}

/** Create a new campaign + seed the per-recipient rows in a single helper. */
export async function createCampaign(
  db: Db,
  input: {
    sessionId: string;
    projectId?: string;
    name: string;
    payload: JsonValue;
    recipients: string[];
    sendRate?: number;
    jitter?: number;
  },
): Promise<string> {
  const id = `camp_${globalThis.crypto.randomUUID()}`;
  const now = new Date();

  const campaign: CampaignDoc = {
    _id: id,
    projectId: input.projectId,
    sessionId: input.sessionId,
    name: input.name,
    status: 'queued',
    payload: input.payload,
    recipients: input.recipients,
    sendRate: input.sendRate,
    jitter: input.jitter,
    totalCount: input.recipients.length,
    sentCount: 0,
    failedCount: 0,
    cancelledCount: 0,
    consecutiveErrors: 0,
    createdAt: now,
    updatedAt: now,
  };
  await campaignsCollection(db).insertOne(campaign);

  if (input.recipients.length > 0) {
    const rows: RecipientDoc[] = input.recipients.map((jid, idx) => ({
      _id: `${id}:${jid}`,
      campaignId: id,
      sessionId: input.sessionId,
      jid,
      order: idx + 1,
      status: 'pending',
      updatedAt: now,
    }));
    await recipientsCollection(db).insertMany(rows, { ordered: false }).catch(() => undefined);
  }
  return id;
}

export async function listRecipients(db: Db, campaignId: string): Promise<RecipientDoc[]> {
  return recipientsCollection(db).find({ campaignId }).sort({ order: 1 }).toArray();
}

export async function upsertRecipient(
  db: Db,
  input: {
    campaignId: string;
    sessionId: string;
    jid: string;
    order: number;
    status: RecipientStatus;
    error?: string;
  },
): Promise<void> {
  const now = new Date();
  await recipientsCollection(db).updateOne(
    { _id: `${input.campaignId}:${input.jid}` },
    {
      $set: {
        campaignId: input.campaignId,
        sessionId: input.sessionId,
        jid: input.jid,
        order: input.order,
        status: input.status,
        ...(input.error !== undefined ? { error: input.error } : {}),
        ...(input.status === 'sent' ? { sentAt: now } : {}),
        updatedAt: now,
      },
    },
    { upsert: true },
  );
}

export async function setStatus(
  db: Db,
  id: string,
  status: CampaignStatus,
  extra?: Partial<CampaignDoc>,
): Promise<void> {
  const now = new Date();
  const setOps: Partial<CampaignDoc> & { status: CampaignStatus; updatedAt: Date } = {
    status,
    updatedAt: now,
    ...extra,
  };
  if (status === 'running' && !extra?.startedAt) {
    setOps.startedAt = now;
  }
  if (status === 'completed' || status === 'aborted' || status === 'failed') {
    setOps.finishedAt = now;
  }
  await campaignsCollection(db).updateOne({ _id: id }, { $set: setOps });
}

export async function bumpProgress(
  db: Db,
  id: string,
  sentDelta: number,
  failedDelta: number,
): Promise<void> {
  if (sentDelta === 0 && failedDelta === 0) return;
  await campaignsCollection(db).updateOne(
    { _id: id },
    {
      $inc: { sentCount: sentDelta, failedCount: failedDelta },
      $set: { updatedAt: new Date() },
    },
  );
}

export async function setConsecutiveErrors(db: Db, id: string, n: number): Promise<void> {
  await campaignsCollection(db).updateOne(
    { _id: id },
    { $set: { consecutiveErrors: n, updatedAt: new Date() } },
  );
}

export async function cancelRemainingRecipients(
  db: Db,
  campaignId: string,
): Promise<number> {
  const res = await recipientsCollection(db).updateMany(
    { campaignId, status: 'pending' },
    { $set: { status: 'cancelled', updatedAt: new Date() } },
  );
  return res.modifiedCount;
}

export async function countPending(db: Db, campaignId: string): Promise<number> {
  return recipientsCollection(db).countDocuments({ campaignId, status: 'pending' });
}

export function toWire(doc: CampaignDoc, recipients: RecipientDoc[]): CampaignWire {
  return {
    _id: doc._id,
    sessionId: doc.sessionId,
    name: doc.name,
    status: doc.status,
    payload: doc.payload,
    perMinute: doc.sendRate,
    jitterSec: doc.jitter,
    totalCount: doc.totalCount,
    sentCount: doc.sentCount,
    failedCount: doc.failedCount,
    recipients: recipients.map((r) => ({
      jid: r.jid,
      status: r.status,
      error: r.error,
      sentAt: r.sentAt,
    })),
    startedAt: doc.startedAt,
    completedAt: doc.finishedAt,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}
