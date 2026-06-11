import 'server-only';

/**
 * SabPay — outbound webhooks (server-only).
 *
 * Merchants register HTTPS endpoints; SabPay POSTs a signed envelope on
 * every subscribed payment event, exactly like the major gateways:
 *
 *   POST <endpoint url>
 *   X-SabPay-Signature: sha256=<hmac-sha256 hex of the raw body>
 *   X-SabPay-Event: payment.succeeded
 *
 * Transport (HMAC signing, retry + exponential backoff, 5 attempts,
 * 0.5s→8s gaps) is reused verbatim from the platform-wide
 * `@/lib/api-platform/webhooks` so the convention matches the rest of
 * SabNode. Endpoints auto-disable after MAX_CONSECUTIVE_FAILURES, and
 * every delivery is logged to `sabpay_webhook_deliveries` for the
 * dashboard's "recent deliveries" view.
 *
 * Dispatch is best-effort and must be fired without awaiting from the
 * payment write path: `void dispatchSabpayEvent(...)`.
 */

import {
  ObjectId,
  type Collection,
  type Db,
  type Filter,
  type IndexDescription,
} from 'mongodb';
import { randomBytes } from 'node:crypto';

import { connectToDatabase } from '@/lib/mongodb';
import { deliverWebhook, signPayload, verifySignature } from '@/lib/api-platform/webhooks';
import {
  isSabpayWebhookEvent,
  SABPAY_WEBHOOK_EVENTS,
  type SabpayMode,
  type SabpayPayment,
  type SabpayWebhookDelivery,
  type SabpayWebhookEndpoint,
  type SabpayWebhookEnvelope,
  type SabpayWebhookEvent,
} from './types';

export const MAX_CONSECUTIVE_FAILURES = 10;
const SECRET_BYTES = 32;
/** Keep the per-user delivery log bounded. */
const DELIVERY_LOG_LIMIT = 500;

/* ── Persisted shapes ────────────────────────────────────────────────────── */

export interface SabpayWebhookEndpointDoc {
  _id: ObjectId;
  userId: ObjectId;
  url: string;
  events: SabpayWebhookEvent[];
  /** Clear-text signing secret ("whsec_…"); never serialised after create/rotate. */
  secret: string;
  description?: string;
  active: boolean;
  failureCount: number;
  lastDeliveryAt?: string;
  lastStatus?: number | null;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SabpayWebhookDeliveryDoc {
  _id: ObjectId;
  userId: ObjectId;
  endpointId: ObjectId;
  url: string;
  event: SabpayWebhookEvent;
  paymentId: string;
  success: boolean;
  status: number | null;
  attempts: number;
  error?: string;
  createdAt: string;
}

async function getDb(): Promise<Db> {
  const { db } = await connectToDatabase();
  return db;
}

export async function sabpayWebhookEndpoints(): Promise<
  Collection<SabpayWebhookEndpointDoc>
> {
  return (await getDb()).collection<SabpayWebhookEndpointDoc>('sabpay_webhook_endpoints');
}

export async function sabpayWebhookDeliveries(): Promise<
  Collection<SabpayWebhookDeliveryDoc>
> {
  return (await getDb()).collection<SabpayWebhookDeliveryDoc>('sabpay_webhook_deliveries');
}

let indexesEnsured = false;

async function ensureIndexes(): Promise<void> {
  if (indexesEnsured) return;
  const [endpoints, deliveries] = await Promise.all([
    sabpayWebhookEndpoints(),
    sabpayWebhookDeliveries(),
  ]);
  await Promise.all([
    endpoints.createIndexes([
      { key: { userId: 1, createdAt: -1 } },
      { key: { userId: 1, active: 1, events: 1 } },
    ] as IndexDescription[]),
    deliveries.createIndexes([
      { key: { userId: 1, createdAt: -1 } },
      { key: { endpointId: 1, createdAt: -1 } },
    ] as IndexDescription[]),
  ]);
  indexesEnsured = true;
}

/* ── Serialisation ───────────────────────────────────────────────────────── */

function docToEndpoint(
  doc: SabpayWebhookEndpointDoc,
  opts?: { revealSecret?: boolean },
): SabpayWebhookEndpoint {
  return {
    _id: doc._id.toHexString(),
    url: doc.url,
    events: doc.events,
    description: doc.description,
    active: doc.active,
    failureCount: doc.failureCount,
    lastDeliveryAt: doc.lastDeliveryAt,
    lastStatus: doc.lastStatus,
    lastError: doc.lastError,
    secret: opts?.revealSecret ? doc.secret : undefined,
    hasSecret: Boolean(doc.secret),
    createdAt: doc.createdAt,
  };
}

function docToDelivery(doc: SabpayWebhookDeliveryDoc): SabpayWebhookDelivery {
  return {
    _id: doc._id.toHexString(),
    endpointId: doc.endpointId.toHexString(),
    url: doc.url,
    event: doc.event,
    paymentId: doc.paymentId,
    success: doc.success,
    status: doc.status,
    attempts: doc.attempts,
    error: doc.error,
    createdAt: doc.createdAt,
  };
}

/* ── Validation ──────────────────────────────────────────────────────────── */

function validateUrl(url: unknown): string {
  if (typeof url !== 'string' || !url.trim()) {
    throw new Error('Endpoint URL is required.');
  }
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    throw new Error('Endpoint URL is not a valid URL.');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Endpoint URL must use http or https.');
  }
  return parsed.toString();
}

function normaliseEvents(events: unknown): SabpayWebhookEvent[] {
  if (!Array.isArray(events) || events.length === 0) {
    throw new Error(
      `Pick at least one event (${SABPAY_WEBHOOK_EVENTS.join(', ')}).`,
    );
  }
  const seen = new Set<SabpayWebhookEvent>();
  for (const e of events) {
    if (!isSabpayWebhookEvent(e)) {
      throw new Error(`Unknown event "${String(e)}".`);
    }
    seen.add(e);
  }
  return [...seen];
}

function generateSecret(): string {
  return `whsec_${randomBytes(SECRET_BYTES).toString('hex')}`;
}

/* ── CRUD ────────────────────────────────────────────────────────────────── */

export async function listEndpoints(userId: ObjectId): Promise<SabpayWebhookEndpoint[]> {
  await ensureIndexes();
  const col = await sabpayWebhookEndpoints();
  const docs = await col
    .find({ userId } as Filter<SabpayWebhookEndpointDoc>)
    .sort({ createdAt: -1 })
    .toArray();
  return docs.map((d) => docToEndpoint(d));
}

export async function createEndpoint(
  userId: ObjectId,
  input: { url: string; events: SabpayWebhookEvent[]; description?: string },
): Promise<SabpayWebhookEndpoint> {
  const url = validateUrl(input.url);
  const events = normaliseEvents(input.events);
  const now = new Date().toISOString();
  const doc: Omit<SabpayWebhookEndpointDoc, '_id'> = {
    userId,
    url,
    events,
    secret: generateSecret(),
    description: input.description?.trim().slice(0, 200) || undefined,
    active: true,
    failureCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  await ensureIndexes();
  const col = await sabpayWebhookEndpoints();
  const result = await col.insertOne(doc as SabpayWebhookEndpointDoc);
  return docToEndpoint(
    { ...doc, _id: result.insertedId } as SabpayWebhookEndpointDoc,
    { revealSecret: true },
  );
}

export async function updateEndpoint(
  userId: ObjectId,
  id: string,
  patch: { url?: string; events?: SabpayWebhookEvent[]; description?: string; active?: boolean },
): Promise<SabpayWebhookEndpoint | null> {
  if (!ObjectId.isValid(id)) return null;
  const set: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (patch.url !== undefined) set.url = validateUrl(patch.url);
  if (patch.events !== undefined) set.events = normaliseEvents(patch.events);
  if (patch.description !== undefined) {
    set.description = patch.description.trim().slice(0, 200) || undefined;
  }
  if (patch.active !== undefined) {
    set.active = patch.active;
    if (patch.active) set.failureCount = 0;
  }
  const col = await sabpayWebhookEndpoints();
  const updated = await col.findOneAndUpdate(
    { _id: new ObjectId(id), userId } as Filter<SabpayWebhookEndpointDoc>,
    { $set: set },
    { returnDocument: 'after' },
  );
  return updated ? docToEndpoint(updated) : null;
}

export async function rotateEndpointSecret(
  userId: ObjectId,
  id: string,
): Promise<SabpayWebhookEndpoint | null> {
  if (!ObjectId.isValid(id)) return null;
  const col = await sabpayWebhookEndpoints();
  const updated = await col.findOneAndUpdate(
    { _id: new ObjectId(id), userId } as Filter<SabpayWebhookEndpointDoc>,
    { $set: { secret: generateSecret(), updatedAt: new Date().toISOString() } },
    { returnDocument: 'after' },
  );
  return updated ? docToEndpoint(updated, { revealSecret: true }) : null;
}

export async function deleteEndpoint(userId: ObjectId, id: string): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false;
  const col = await sabpayWebhookEndpoints();
  const result = await col.deleteOne({
    _id: new ObjectId(id),
    userId,
  } as Filter<SabpayWebhookEndpointDoc>);
  return result.deletedCount === 1;
}

export async function listDeliveries(
  userId: ObjectId,
  limit = 50,
): Promise<SabpayWebhookDelivery[]> {
  await ensureIndexes();
  const col = await sabpayWebhookDeliveries();
  const docs = await col
    .find({ userId } as Filter<SabpayWebhookDeliveryDoc>)
    .sort({ createdAt: -1 })
    .limit(Math.min(Math.max(limit, 1), 200))
    .toArray();
  return docs.map(docToDelivery);
}

/* ── Dispatch ────────────────────────────────────────────────────────────── */

/**
 * Fans a payment event out to every active matching endpoint of the
 * merchant. Never throws; call fire-and-forget from the payment write:
 * `void dispatchSabpayEvent(userId, 'payment.succeeded', payment)`.
 */
export async function dispatchSabpayEvent(
  userId: ObjectId,
  event: SabpayWebhookEvent,
  payment: SabpayPayment,
): Promise<void> {
  try {
    if (!isSabpayWebhookEvent(event)) return;
    await ensureIndexes();
    const col = await sabpayWebhookEndpoints();
    const endpoints = await col
      .find({ userId, active: true, events: event } as Filter<SabpayWebhookEndpointDoc>)
      .toArray();
    if (endpoints.length === 0) return;

    const envelope: SabpayWebhookEnvelope = {
      id: `evt_${randomBytes(12).toString('hex')}`,
      event,
      mode: payment.mode as SabpayMode,
      timestamp: new Date().toISOString(),
      data: { payment },
    };

    await Promise.all(
      endpoints.map((endpoint) => deliverToEndpoint(col, endpoint, envelope)),
    );
  } catch (err) {
    console.error('[sabpay] webhook dispatch failed', err);
  }
}

async function deliverToEndpoint(
  col: Collection<SabpayWebhookEndpointDoc>,
  endpoint: SabpayWebhookEndpointDoc,
  envelope: SabpayWebhookEnvelope,
): Promise<void> {
  const now = new Date().toISOString();
  let success = false;
  let status: number | null = null;
  let attempts = 0;
  let error: string | undefined;

  try {
    const delivery = await deliverWebhook(endpoint.url, envelope, {
      secret: endpoint.secret,
      event: envelope.event,
      tenantId: endpoint.userId.toHexString(),
      webhookId: endpoint._id.toHexString(),
    });
    success = delivery.success;
    status = delivery.responseStatus;
    attempts = delivery.attempts;
    error = delivery.error;
  } catch (err) {
    error = err instanceof Error ? err.message : 'Delivery failed.';
  }

  // Bookkeeping on the endpoint (+ auto-disable after the failure cap).
  try {
    if (success) {
      await col.updateOne(
        { _id: endpoint._id } as Filter<SabpayWebhookEndpointDoc>,
        {
          $set: {
            failureCount: 0,
            lastDeliveryAt: now,
            lastStatus: status,
            lastError: undefined,
            updatedAt: now,
          },
        },
      );
    } else {
      const nextFailureCount = (endpoint.failureCount ?? 0) + 1;
      const set: Record<string, unknown> = {
        failureCount: nextFailureCount,
        lastDeliveryAt: now,
        lastStatus: status,
        lastError: error ?? `HTTP ${String(status)}`,
        updatedAt: now,
      };
      if (nextFailureCount >= MAX_CONSECUTIVE_FAILURES) set.active = false;
      await col.updateOne(
        { _id: endpoint._id } as Filter<SabpayWebhookEndpointDoc>,
        { $set: set },
      );
    }
  } catch (err) {
    console.error('[sabpay] webhook bookkeeping failed', err);
  }

  // Delivery log (bounded: trim the tail past DELIVERY_LOG_LIMIT).
  try {
    const deliveries = await sabpayWebhookDeliveries();
    await deliveries.insertOne({
      userId: endpoint.userId,
      endpointId: endpoint._id,
      url: endpoint.url,
      event: envelope.event,
      paymentId:
        (envelope.data as { payment?: { id?: string } } | undefined)?.payment?.id ?? '',
      success,
      status,
      attempts,
      error,
      createdAt: now,
    } as SabpayWebhookDeliveryDoc);
    const excess = await deliveries
      .find({ userId: endpoint.userId } as Filter<SabpayWebhookDeliveryDoc>)
      .sort({ createdAt: -1 })
      .skip(DELIVERY_LOG_LIMIT)
      .project({ _id: 1 })
      .toArray();
    if (excess.length > 0) {
      await deliveries.deleteMany({
        _id: { $in: excess.map((d) => d._id) },
      } as Filter<SabpayWebhookDeliveryDoc>);
    }
  } catch (err) {
    console.error('[sabpay] webhook delivery log failed', err);
  }
}

/* ── Signature helpers (for docs / merchant SDK verification) ────────────── */

export function signSabpayPayload(secret: string, body: unknown): string {
  return signPayload(secret, body);
}

export function verifySabpaySignature(
  secret: string,
  body: unknown,
  signature: string,
): boolean {
  return verifySignature(secret, body, signature);
}
