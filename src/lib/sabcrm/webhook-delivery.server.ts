import 'server-only';

/**
 * SabCRM — signed + retried webhook delivery runtime (server-only).
 *
 * The delivery + ledger half of the signed-webhooks vertical. It sits ON TOP of
 * the existing subscription store in `./webhooks.server.ts` (`sabcrm_webhooks`,
 * which owns the per-subscription `secret`, `events`, `url`, `active` flag and
 * the failure bookkeeping). This module does NOT re-implement subscriptions; it
 * adds:
 *
 *   1. {@link deliverWebhook} — POST one event to one subscription with the
 *      timestamped HMAC signature header, recording the attempt in the
 *      `sabcrm_webhook_deliveries` ledger and scheduling a retry (`nextRetryAt`)
 *      when the outcome is retryable.
 *   2. {@link deliverEvent} — fan an event out to every active subscription that
 *      subscribes to it (the integration call site for a CRM mutation).
 *   3. {@link processDueRetries} — the cron entry point: pick up every delivery
 *      whose `nextRetryAt <= now`, re-POST it, and re-schedule or finalise.
 *   4. {@link retryDelivery} — manual single-delivery retry (settings UI).
 *   5. {@link rotateSubscriptionSecret} — rotate a subscription's signing secret.
 *
 * ## Storage
 *
 * Deliveries live in their own `sabcrm_webhook_deliveries` collection (a NEW
 * domain collection — it MAY own its own `updatedAt`). Each row is one logical
 * delivery (NOT one attempt): it carries the running `attempt` count, the
 * latest `status`/`responseCode`/`error`, the `deliveryStatus`
 * (`pending|delivered|failed`), and `nextRetryAt` (absent once terminal). The
 * envelope/body is stored verbatim so a retry re-sends a byte-identical body and
 * a stable signature (modulo the fresh timestamp).
 *
 * ## Contracts
 *
 * - **Tenant-scoped**: every read/write filters by `projectId`.
 * - **Best-effort dispatch**: {@link deliverEvent} never throws and never blocks
 *   the triggering write — call it `void deliverEvent(...)`.
 * - **Reuses the subscription store** in `./webhooks.server.ts` verbatim for the
 *   `secret`, never duplicating it.
 * - **No `any`**: Mongo-boundary casts go through `Record<string, unknown>`.
 */

import { ObjectId, type Collection, type Db, type Filter, type IndexDescription } from 'mongodb';
import { randomBytes, randomUUID } from 'node:crypto';

import { connectToDatabase } from '@/lib/mongodb';
import {
  sabcrmWebhooks,
  type SabcrmWebhookDoc,
  type WebhookEnvelope,
} from './webhooks.server';
import {
  type SabcrmWebhookEvent,
  isSabcrmWebhookEvent,
} from './webhook-events';
import {
  signPayload,
  canonicalBody,
  backoffDelayMs,
  shouldRetry,
  isSuccessStatus,
  DEFAULT_MAX_ATTEMPTS,
  SABCRM_SIGNATURE_HEADER,
  SABCRM_TIMESTAMP_HEADER,
  SABCRM_EVENT_HEADER,
  SABCRM_DELIVERY_HEADER,
} from './webhook-delivery';

/* -------------------------------------------------------------------------- */
/* Collection + document shape                                                 */
/* -------------------------------------------------------------------------- */

/** Mongo collection holding the per-delivery ledger. */
export const SABCRM_WEBHOOK_DELIVERIES_COLLECTION = 'sabcrm_webhook_deliveries' as const;

/** Per-attempt timeout (ms). */
const ATTEMPT_TIMEOUT_MS = 10_000;

/** How many due retries a single cron pass processes (back-pressure cap). */
const MAX_RETRIES_PER_RUN = 200;

/** Lifecycle state of a logical delivery. */
export type WebhookDeliveryStatus = 'pending' | 'delivered' | 'failed';

/** One persisted delivery (the running record across all of its attempts). */
export interface SabcrmWebhookDeliveryDoc {
  _id: ObjectId;
  projectId: string;
  /** The subscription this delivery targets (hex of `sabcrm_webhooks._id`). */
  webhookId: string;
  /** Destination URL snapshotted at first send (immune to later edits). */
  url: string;
  /** The subscribed event that fired. */
  event: SabcrmWebhookEvent;
  /** Unique idempotency key sent to the receiver in `X-SabNode-Delivery`. */
  deliveryId: string;
  /** The verbatim envelope body (re-sent byte-identical on retry). */
  body: WebhookEnvelope | Record<string, unknown>;
  /** Lifecycle state. */
  deliveryStatus: WebhookDeliveryStatus;
  /** Attempts performed so far (1-based; 0 before the first send). */
  attempt: number;
  /** Total attempts permitted. */
  maxAttempts: number;
  /** HTTP status of the last attempt, or null on transport error. */
  responseCode: number | null;
  /** Truncated response body of the last attempt (≤ 4 KB). */
  responseBody?: string;
  /** Last error string, if any. */
  error?: string;
  /** ISO timestamp of the last attempt. */
  lastAttemptAt?: string;
  /** ISO timestamp the cron should re-attempt at; absent once terminal. */
  nextRetryAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Client-facing serialised shape (ids → hex strings, body redacted to a preview). */
export interface WebhookDeliveryRow {
  _id: string;
  projectId: string;
  webhookId: string;
  url: string;
  event: SabcrmWebhookEvent;
  deliveryId: string;
  deliveryStatus: WebhookDeliveryStatus;
  attempt: number;
  maxAttempts: number;
  responseCode: number | null;
  responseBody?: string;
  error?: string;
  lastAttemptAt?: string;
  nextRetryAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

/* -------------------------------------------------------------------------- */
/* Collection accessor + index bootstrap                                       */
/* -------------------------------------------------------------------------- */

async function getDb(): Promise<Db> {
  const { db } = await connectToDatabase();
  return db;
}

/** Typed accessor for the deliveries ledger. */
export async function sabcrmWebhookDeliveries(): Promise<
  Collection<SabcrmWebhookDeliveryDoc>
> {
  const db = await getDb();
  return db.collection<SabcrmWebhookDeliveryDoc>(
    SABCRM_WEBHOOK_DELIVERIES_COLLECTION,
  );
}

let indexesEnsured = false;

/**
 * Idempotently ensures the delivery-ledger indexes. Runs once per process.
 *
 * • `{projectId, createdAt}`            — management log, newest first.
 * • `{deliveryStatus, nextRetryAt}`     — the cron hot path (due retries).
 * • `{projectId, webhookId, createdAt}` — per-subscription drill-down.
 */
export async function ensureDeliveryIndexes(): Promise<void> {
  if (indexesEnsured) return;
  const col = await sabcrmWebhookDeliveries();
  await col.createIndexes([
    { key: { projectId: 1, createdAt: -1 } },
    { key: { deliveryStatus: 1, nextRetryAt: 1 } },
    { key: { projectId: 1, webhookId: 1, createdAt: -1 } },
  ] as IndexDescription[]);
  indexesEnsured = true;
}

/* -------------------------------------------------------------------------- */
/* Serialisation                                                               */
/* -------------------------------------------------------------------------- */

function docToRow(doc: SabcrmWebhookDeliveryDoc): WebhookDeliveryRow {
  return {
    _id: doc._id.toHexString(),
    projectId: doc.projectId,
    webhookId: doc.webhookId,
    url: doc.url,
    event: doc.event,
    deliveryId: doc.deliveryId,
    deliveryStatus: doc.deliveryStatus,
    attempt: doc.attempt,
    maxAttempts: doc.maxAttempts,
    responseCode: doc.responseCode,
    responseBody: doc.responseBody,
    error: doc.error,
    lastAttemptAt: doc.lastAttemptAt,
    nextRetryAt: doc.nextRetryAt,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/* -------------------------------------------------------------------------- */
/* HTTP attempt                                                                 */
/* -------------------------------------------------------------------------- */

interface AttemptResult {
  status: number | null;
  body?: string;
  error?: string;
}

/**
 * Perform exactly one signed POST. Never throws — a transport error resolves to
 * `{ status: null, error }`. The signature timestamp is fresh per attempt and
 * sent alongside the signature so the receiver can verify + replay-check.
 */
async function attemptOnce(
  url: string,
  body: WebhookEnvelope | Record<string, unknown>,
  secret: string,
  event: string,
  deliveryId: string,
): Promise<AttemptResult> {
  const serialised = canonicalBody(body);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = signPayload(serialised, secret, timestamp);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'SabNode-SabCRM-Webhooks/1.0',
        [SABCRM_SIGNATURE_HEADER]: signature,
        [SABCRM_TIMESTAMP_HEADER]: String(timestamp),
        [SABCRM_EVENT_HEADER]: event,
        [SABCRM_DELIVERY_HEADER]: deliveryId,
      },
      body: serialised,
      signal: controller.signal,
    });
    const text = await res.text().catch(() => '');
    return { status: res.status, body: text.slice(0, 4096) };
  } catch (err) {
    return {
      status: null,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

/* -------------------------------------------------------------------------- */
/* Subscription secret lookup / rotation                                       */
/* -------------------------------------------------------------------------- */

/** Bytes of entropy for a rotated secret (-> 64 hex chars). */
const SECRET_BYTES = 32;

/** Fetch the raw subscription doc (with its clear-text secret), or null. */
async function getSubscriptionDoc(
  projectId: string,
  webhookId: string,
): Promise<SabcrmWebhookDoc | null> {
  if (!ObjectId.isValid(webhookId)) return null;
  const subs = await sabcrmWebhooks();
  return subs.findOne({
    _id: new ObjectId(webhookId),
    projectId,
  } as Filter<SabcrmWebhookDoc>);
}

/**
 * Rotate a subscription's signing secret. Returns the new clear-text secret
 * exactly once (so the operator can re-key the receiver), or null when the
 * subscription does not exist. Bumps the subscription's own `updatedAt`.
 */
export async function rotateSubscriptionSecret(
  projectId: string,
  webhookId: string,
): Promise<{ secret: string } | null> {
  if (!ObjectId.isValid(webhookId)) return null;
  const secret = randomBytes(SECRET_BYTES).toString('hex');
  const subs = await sabcrmWebhooks();
  const updated = await subs.findOneAndUpdate(
    { _id: new ObjectId(webhookId), projectId } as Filter<SabcrmWebhookDoc>,
    { $set: { secret, updatedAt: new Date().toISOString() } },
    { returnDocument: 'after' },
  );
  return updated ? { secret } : null;
}

/* -------------------------------------------------------------------------- */
/* Core: deliver / record one attempt                                          */
/* -------------------------------------------------------------------------- */

/** Outcome of attempting (or re-attempting) one delivery. */
export interface DeliveryAttemptOutcome {
  deliveryRowId: string;
  success: boolean;
  status: number | null;
  attempt: number;
  willRetry: boolean;
  nextRetryAt: string | null;
}

/**
 * Run one attempt against an EXISTING delivery doc + its subscription, then
 * persist the bookkeeping: increment `attempt`, store status/body/error, and
 * either finalise (`delivered`/`failed`) or schedule the next retry. Also keeps
 * the subscription's own failure counters in step with `./webhooks.server.ts`.
 *
 * Pure persistence given the attempt result — never throws.
 */
async function runAttempt(
  delivery: SabcrmWebhookDeliveryDoc,
  sub: SabcrmWebhookDoc,
): Promise<DeliveryAttemptOutcome> {
  const col = await sabcrmWebhookDeliveries();
  const subs = await sabcrmWebhooks();
  const nowIso = new Date().toISOString();
  const attempt = (delivery.attempt ?? 0) + 1;
  const maxAttempts = delivery.maxAttempts || DEFAULT_MAX_ATTEMPTS;

  const result = await attemptOnce(
    delivery.url,
    delivery.body,
    sub.secret,
    delivery.event,
    delivery.deliveryId,
  );

  const success = isSuccessStatus(result.status);
  const willRetry = !success && shouldRetry(result.status, attempt, maxAttempts);
  const nextRetryAt = willRetry
    ? new Date(Date.now() + backoffDelayMs(attempt)).toISOString()
    : null;
  const deliveryStatus: WebhookDeliveryStatus = success
    ? 'delivered'
    : willRetry
      ? 'pending'
      : 'failed';

  const set: Record<string, unknown> = {
    deliveryStatus,
    attempt,
    responseCode: result.status,
    responseBody: result.body,
    error: success ? undefined : result.error ?? `HTTP ${String(result.status)}`,
    lastAttemptAt: nowIso,
    nextRetryAt,
    updatedAt: nowIso,
  };

  await col.updateOne(
    { _id: delivery._id } as Filter<SabcrmWebhookDeliveryDoc>,
    { $set: set },
  );

  // Keep the subscription's own bookkeeping aligned (mirrors webhooks.server).
  try {
    if (success) {
      await subs.updateOne(
        { _id: sub._id } as Filter<SabcrmWebhookDoc>,
        {
          $set: {
            failureCount: 0,
            lastDeliveryAt: nowIso,
            lastStatus: result.status,
            lastError: undefined,
            updatedAt: nowIso,
          },
        },
      );
    } else if (!willRetry) {
      // Terminal failure — count it once against the subscription.
      await subs.updateOne(
        { _id: sub._id } as Filter<SabcrmWebhookDoc>,
        {
          $inc: { failureCount: 1 },
          $set: {
            lastDeliveryAt: nowIso,
            lastStatus: result.status,
            lastError: result.error ?? `HTTP ${String(result.status)}`,
            updatedAt: nowIso,
          },
        },
      );
    }
  } catch {
    // Subscription bookkeeping is non-critical — never fail the delivery on it.
  }

  return {
    deliveryRowId: delivery._id.toHexString(),
    success,
    status: result.status,
    attempt,
    willRetry,
    nextRetryAt,
  };
}

/**
 * Deliver a single `event` to a single subscription. Inserts a new ledger row,
 * runs the first attempt, and schedules a retry if needed. Returns the created
 * row id (and outcome). Best-effort — resolves even when the send fails.
 *
 * @param sub      The subscription doc (carries url + secret).
 * @param event    The event that fired.
 * @param envelope The signed envelope body to POST (built by the caller).
 */
export async function deliverWebhook(
  sub: SabcrmWebhookDoc,
  event: SabcrmWebhookEvent,
  envelope: WebhookEnvelope | Record<string, unknown>,
): Promise<DeliveryAttemptOutcome | null> {
  try {
    await ensureDeliveryIndexes();
    const col = await sabcrmWebhookDeliveries();
    const nowIso = new Date().toISOString();

    const doc: Omit<SabcrmWebhookDeliveryDoc, '_id'> = {
      projectId: sub.projectId,
      webhookId: sub._id.toHexString(),
      url: sub.url,
      event,
      deliveryId: randomUUID(),
      body: envelope,
      deliveryStatus: 'pending',
      attempt: 0,
      maxAttempts: DEFAULT_MAX_ATTEMPTS,
      responseCode: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const insert = await col.insertOne(
      doc as unknown as Parameters<typeof col.insertOne>[0],
    );
    const inserted: SabcrmWebhookDeliveryDoc = {
      ...doc,
      _id: insert.insertedId,
    } as SabcrmWebhookDeliveryDoc;

    return await runAttempt(inserted, sub);
  } catch {
    return null; // best-effort
  }
}

/**
 * Fan an event out to every ACTIVE subscription in `projectId` that subscribes
 * to it, recording a delivery row + first attempt for each. The integration
 * call site for a CRM mutation (call as `void deliverEvent(...)`).
 *
 * The envelope shape matches `./webhooks.server.ts#WebhookEnvelope` so receivers
 * see one consistent body regardless of which dispatch path fired.
 */
export async function deliverEvent(
  projectId: string,
  event: SabcrmWebhookEvent,
  payload: unknown,
): Promise<DeliveryAttemptOutcome[]> {
  try {
    if (!projectId || !isSabcrmWebhookEvent(event)) return [];
    const subs = await sabcrmWebhooks();
    const matching = await subs
      .find({
        projectId,
        active: true,
        events: event,
      } as Filter<SabcrmWebhookDoc>)
      .toArray();
    if (matching.length === 0) return [];

    const envelope: WebhookEnvelope = {
      event,
      projectId,
      timestamp: new Date().toISOString(),
      data: payload,
    };

    const outcomes = await Promise.all(
      matching.map((sub) => deliverWebhook(sub, event, envelope)),
    );
    return outcomes.filter((o): o is DeliveryAttemptOutcome => o !== null);
  } catch {
    return [];
  }
}

/* -------------------------------------------------------------------------- */
/* Retry processing (cron + manual)                                            */
/* -------------------------------------------------------------------------- */

/** Report returned by {@link processDueRetries}. */
export interface RetrySweepReport {
  scanned: number;
  delivered: number;
  retried: number;
  failed: number;
}

/**
 * Process every delivery whose `nextRetryAt <= now` and which is still pending.
 * For each: re-run an attempt and re-schedule or finalise. Bounded per run by
 * {@link MAX_RETRIES_PER_RUN}. The cron entry point. Best-effort — never throws.
 *
 * @param now Reference instant (defaults to `Date.now()`).
 */
export async function processDueRetries(
  now: number = Date.now(),
): Promise<RetrySweepReport> {
  const report: RetrySweepReport = { scanned: 0, delivered: 0, retried: 0, failed: 0 };
  try {
    await ensureDeliveryIndexes();
    const col = await sabcrmWebhookDeliveries();
    const nowIso = new Date(now).toISOString();

    const due = await col
      .find({
        deliveryStatus: 'pending',
        nextRetryAt: { $lte: nowIso },
      } as Filter<SabcrmWebhookDeliveryDoc>)
      .sort({ nextRetryAt: 1 })
      .limit(MAX_RETRIES_PER_RUN)
      .toArray();

    report.scanned = due.length;
    if (due.length === 0) return report;

    for (const delivery of due) {
      const sub = await getSubscriptionDoc(delivery.projectId, delivery.webhookId);
      if (!sub) {
        // Subscription was deleted — finalise the orphaned delivery.
        await col.updateOne(
          { _id: delivery._id } as Filter<SabcrmWebhookDeliveryDoc>,
          {
            $set: {
              deliveryStatus: 'failed',
              nextRetryAt: null,
              error: 'Subscription no longer exists.',
              updatedAt: new Date().toISOString(),
            },
          },
        );
        report.failed += 1;
        continue;
      }

      const outcome = await runAttempt(delivery, sub);
      if (outcome.success) report.delivered += 1;
      else if (outcome.willRetry) report.retried += 1;
      else report.failed += 1;
    }

    return report;
  } catch {
    return report;
  }
}

/**
 * Manually re-attempt a single delivery (settings "Retry" button). Resets it to
 * pending if it was terminal, then runs one attempt immediately. Returns the
 * outcome, or null when the delivery / subscription cannot be found.
 */
export async function retryDelivery(
  projectId: string,
  deliveryRowId: string,
): Promise<DeliveryAttemptOutcome | null> {
  try {
    if (!ObjectId.isValid(deliveryRowId)) return null;
    const col = await sabcrmWebhookDeliveries();
    const delivery = await col.findOne({
      _id: new ObjectId(deliveryRowId),
      projectId,
    } as Filter<SabcrmWebhookDeliveryDoc>);
    if (!delivery) return null;

    const sub = await getSubscriptionDoc(projectId, delivery.webhookId);
    if (!sub) return null;

    // A manual retry grants one extra attempt on top of whatever was used, so a
    // terminal delivery can be re-driven without editing the policy.
    const refreshed: SabcrmWebhookDeliveryDoc = {
      ...delivery,
      maxAttempts: Math.max(delivery.maxAttempts || DEFAULT_MAX_ATTEMPTS, delivery.attempt + 1),
      deliveryStatus: 'pending',
    };
    return await runAttempt(refreshed, sub);
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Reads (for the settings log)                                                 */
/* -------------------------------------------------------------------------- */

/** Filters accepted by {@link listDeliveries}. */
export interface ListDeliveriesQuery {
  webhookId?: string;
  status?: WebhookDeliveryStatus;
  limit?: number;
}

/**
 * List recent deliveries for a project (newest first), optionally filtered by
 * subscription and/or status. Capped at 200 rows.
 */
export async function listDeliveries(
  projectId: string,
  query: ListDeliveriesQuery = {},
): Promise<WebhookDeliveryRow[]> {
  if (!projectId) return [];
  await ensureDeliveryIndexes();
  const col = await sabcrmWebhookDeliveries();
  const filter: Record<string, unknown> = { projectId };
  if (query.webhookId && ObjectId.isValid(query.webhookId)) {
    filter.webhookId = query.webhookId;
  }
  if (query.status) filter.deliveryStatus = query.status;

  const limit = Math.min(Math.max(1, query.limit ?? 100), 200);
  const docs = await col
    .find(filter as Filter<SabcrmWebhookDeliveryDoc>)
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
  return docs.map(docToRow);
}
