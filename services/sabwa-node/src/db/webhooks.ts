/**
 * Webhook persistence helpers for `sabwa_webhooks`.
 *
 * The on-disk shape mirrors `SabwaWebhook` in `src/lib/sabwa/types.ts`. We
 * expose:
 *   - `listWebhooks(state, projectId)`
 *   - `createWebhook(state, input)`
 *   - `patchWebhook(state, id, patch)`
 *   - `deleteWebhook(state, id)`
 *   - `findWebhook(state, id)` — used by the test-fire route
 *   - `recordDelivery(state, id, status)` — tiny helper for the test endpoint
 */

import { Collection, ObjectId, type Db } from 'mongodb';
import type { AppState } from '../state.js';

export type WebhookEvent =
  | 'message.received'
  | 'message.status'
  | 'chat.updated'
  | 'group.joined'
  | 'group.left'
  | 'session.connected'
  | 'session.disconnected'
  | 'scheduled.fired'
  | (string & {});

export interface WebhookDoc {
  _id: ObjectId;
  projectId: ObjectId;
  sessionId?: ObjectId;
  url: string;
  events: WebhookEvent[];
  /** Stored under both names; canonical is `signingSecret`. */
  signingSecret: string;
  enabled: boolean;
  lastDeliveryAt?: Date;
  lastDeliveryStatus?: number;
  failureCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookWire {
  id: string;
  projectId: string;
  sessionId?: string;
  url: string;
  events: WebhookEvent[];
  /** Secret is returned for project-scoped admin reads (parity with Rust engine). */
  signingSecret: string;
  hmacSecret: string;
  enabled: boolean;
  lastDeliveryAt?: string;
  lastDeliveryStatus?: number;
  failureCount: number;
  createdAt: string;
  updatedAt: string;
}

const COLL = 'sabwa_webhooks';

function coll(db: Db): Collection<WebhookDoc> {
  return db.collection<WebhookDoc>(COLL);
}

function toWire(d: WebhookDoc): WebhookWire {
  const out: WebhookWire = {
    id: d._id.toHexString(),
    projectId: d.projectId.toHexString(),
    url: d.url,
    events: d.events ?? [],
    signingSecret: d.signingSecret,
    hmacSecret: d.signingSecret,
    enabled: d.enabled,
    failureCount: d.failureCount ?? 0,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  };
  if (d.sessionId) out.sessionId = d.sessionId.toHexString();
  if (d.lastDeliveryAt) out.lastDeliveryAt = d.lastDeliveryAt.toISOString();
  if (d.lastDeliveryStatus !== undefined) out.lastDeliveryStatus = d.lastDeliveryStatus;
  return out;
}

export async function listWebhooks(
  state: AppState,
  projectId: string,
): Promise<WebhookWire[]> {
  if (!ObjectId.isValid(projectId)) return [];
  const docs = await coll(state.db)
    .find({ projectId: new ObjectId(projectId) })
    .sort({ createdAt: -1 })
    .toArray();
  return docs.map(toWire);
}

export interface CreateWebhookInput {
  projectId: string;
  sessionId?: string;
  url: string;
  events: WebhookEvent[];
  hmacSecret: string;
  enabled?: boolean;
}

export async function createWebhook(
  state: AppState,
  input: CreateWebhookInput,
): Promise<WebhookWire | null> {
  if (!ObjectId.isValid(input.projectId)) return null;
  const now = new Date();
  const doc: WebhookDoc = {
    _id: new ObjectId(),
    projectId: new ObjectId(input.projectId),
    url: input.url,
    events: input.events,
    signingSecret: input.hmacSecret,
    enabled: input.enabled ?? true,
    failureCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  if (input.sessionId && ObjectId.isValid(input.sessionId)) {
    doc.sessionId = new ObjectId(input.sessionId);
  }
  await coll(state.db).insertOne(doc);
  return toWire(doc);
}

export interface PatchWebhookInput {
  url?: string;
  events?: WebhookEvent[];
  hmacSecret?: string;
  enabled?: boolean;
}

export async function patchWebhook(
  state: AppState,
  id: string,
  patch: PatchWebhookInput,
): Promise<WebhookWire | null> {
  if (!ObjectId.isValid(id)) return null;
  const update: Partial<WebhookDoc> = { updatedAt: new Date() };
  if (patch.url !== undefined) update.url = patch.url;
  if (patch.events !== undefined) update.events = patch.events;
  if (patch.hmacSecret !== undefined) update.signingSecret = patch.hmacSecret;
  if (patch.enabled !== undefined) update.enabled = patch.enabled;
  const r = await coll(state.db).findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: update },
    { returnDocument: 'after' },
  );
  return r ? toWire(r) : null;
}

export async function deleteWebhook(state: AppState, id: string): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false;
  const r = await coll(state.db).deleteOne({ _id: new ObjectId(id) });
  return r.deletedCount === 1;
}

export async function findWebhook(
  state: AppState,
  id: string,
): Promise<WebhookDoc | null> {
  if (!ObjectId.isValid(id)) return null;
  return coll(state.db).findOne({ _id: new ObjectId(id) });
}

/** Record the outcome of a delivery attempt (test or real). */
export async function recordDelivery(
  state: AppState,
  id: string,
  status: number,
  ok: boolean,
): Promise<void> {
  if (!ObjectId.isValid(id)) return;
  const update: Record<string, unknown> = {
    $set: {
      lastDeliveryAt: new Date(),
      lastDeliveryStatus: status,
      updatedAt: new Date(),
    },
  };
  if (ok) {
    (update.$set as Record<string, unknown>).failureCount = 0;
  } else {
    update.$inc = { failureCount: 1 };
  }
  await coll(state.db).updateOne({ _id: new ObjectId(id) }, update);
}

export const __forTest = { COLL, toWire };
