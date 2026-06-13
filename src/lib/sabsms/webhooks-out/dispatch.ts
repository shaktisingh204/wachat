/**
 * SabSMS outbound webhooks — dispatcher (V2.13).
 *
 * Two halves, both riding the existing events worker
 * (`scripts/sabsms-events-worker.mjs` → `../events/consumer.ts`):
 *
 *   1. [`registerWebhookOutEventHandlers`] — the 5th ADDITIVE consumer
 *      registration (after journeys/analytics/identity/agent). A
 *      wildcard handler fans every engine event out to the workspace's
 *      matching `sabsms_webhooks_out` endpoints by inserting one
 *      `sabsms_webhook_deliveries` doc per endpoint. Replay-tolerant:
 *      the insert upserts on `(webhookId, sourceEventId)` so an XACK
 *      crash can never duplicate a delivery.
 *
 *   2. [`tickWebhookDeliveries`] — a wakeAt-claimed loop (same lease
 *      pattern as the V2.9 journey ticker) that POSTs due deliveries
 *      with an HMAC-SHA256 signature and drives the
 *      [30s, 5m, 1h, 6h] retry backoff. Terminal failures are marked
 *      `failed` (the Phase-0 schema's name for failed_permanent).
 *
 * Worker-safe: relative imports only, no `server-only`.
 */

import { ObjectId, type Collection, type Db } from 'mongodb';

import {
  ALL_KINDS,
  eventWorkspaceId,
  type HandlerContext,
  type SabsmsEngineEvent,
  type SabsmsEventRouter,
} from '../events/consumer';
import {
  buildEventBody,
  eventMatchesFilter,
  nextAttemptAt,
  publicEventName,
  signatureHeaders,
} from './core';

export const WEBHOOKS_OUT_COLLECTION = 'sabsms_webhooks_out';
export const WEBHOOK_DELIVERIES_COLLECTION = 'sabsms_webhook_deliveries';

/** How long a claimed delivery is leased before another tick may retry it. */
const CLAIM_LEASE_MS = 90_000;

/** Per-attempt HTTP timeout. */
const ATTEMPT_TIMEOUT_MS = 10_000;

/** Max deliveries attempted per tick (keeps the tick bounded). */
const MAX_PER_TICK = 10;

// ─── Doc shapes (Phase-0 schema + additive V2.13 fields) ───────────────────

export interface WebhookEndpointDoc {
  _id?: ObjectId;
  workspaceId: string;
  url: string;
  secret: string;
  events: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookDeliveryAttempt {
  attemptedAt: Date;
  /** HTTP status, 0 = transport error/timeout. */
  status: number;
  responseSnippet?: string;
  error?: string;
}

export interface WebhookDeliveryDoc {
  _id?: ObjectId;
  workspaceId: string;
  webhookId: string;
  /** Public dotted event name ("message.delivered"). */
  event: string;
  payload: Record<string, unknown>;
  attempts: WebhookDeliveryAttempt[];
  status: 'pending' | 'delivered' | 'failed';
  createdAt: Date;
  deliveredAt?: Date;
  // V2.13 additive fields:
  /** Next attempt is due when wakeAt <= now (lease-bumped while claimed). */
  wakeAt?: Date;
  /** Source event epoch ms. */
  eventAt?: number;
  /** Stream entry id (or synthetic id) — the replay-dedupe key. */
  sourceEventId?: string;
}

function endpoints(db: Db): Collection<WebhookEndpointDoc> {
  return db.collection<WebhookEndpointDoc>(WEBHOOKS_OUT_COLLECTION);
}

function deliveries(db: Db): Collection<WebhookDeliveryDoc> {
  return db.collection<WebhookDeliveryDoc>(WEBHOOK_DELIVERIES_COLLECTION);
}

const indexesEnsured = new WeakSet<Db>();

export async function ensureWebhookDeliveryIndexes(db: Db): Promise<void> {
  if (indexesEnsured.has(db)) return;
  indexesEnsured.add(db);
  try {
    await deliveries(db).createIndex({ status: 1, wakeAt: 1 });
    await deliveries(db).createIndex(
      { webhookId: 1, sourceEventId: 1 },
      {
        unique: true,
        partialFilterExpression: { sourceEventId: { $type: 'string' } },
      },
    );
  } catch {
    indexesEnsured.delete(db);
  }
}

// ─── 1. Enqueue (consumer registration) ────────────────────────────────────

/**
 * Fan one engine event out to the workspace's active matching
 * endpoints. Exposed for tests; the consumer calls it via the wildcard
 * handler below.
 */
export async function enqueueWebhookDeliveries(
  db: Db,
  event: SabsmsEngineEvent,
  sourceEventId: string,
): Promise<number> {
  const workspaceId = eventWorkspaceId(event);
  if (!workspaceId) return 0;

  const kind = publicEventName(event.kind);
  if (!kind) return 0;

  const hooks = await endpoints(db)
    .find({ workspaceId, isActive: true })
    .limit(50)
    .toArray();
  if (hooks.length === 0) return 0;

  await ensureWebhookDeliveryIndexes(db);

  const now = new Date();
  let enqueued = 0;
  for (const hook of hooks) {
    if (!hook._id || !eventMatchesFilter(kind, hook.events)) continue;
    // Upsert on (webhookId, sourceEventId): at-least-once stream delivery
    // can replay this handler — the second pass is a no-op.
    const res = await deliveries(db).updateOne(
      { webhookId: hook._id.toHexString(), sourceEventId },
      {
        $setOnInsert: {
          workspaceId,
          webhookId: hook._id.toHexString(),
          event: kind,
          payload: event.payload,
          attempts: [],
          status: 'pending',
          createdAt: now,
          wakeAt: now,
          eventAt: event.at > 0 ? event.at : now.getTime(),
          sourceEventId,
        },
      },
      { upsert: true },
    );
    if (res.upsertedCount > 0) enqueued += 1;
  }
  return enqueued;
}

/**
 * The 5th additive consumer registration. No-ops without `ctx.db`
 * (pure-router unit tests), like every other module's handlers.
 */
export function registerWebhookOutEventHandlers(router: SabsmsEventRouter): SabsmsEventRouter {
  router.on(ALL_KINDS, async (event: SabsmsEngineEvent, ctx: HandlerContext) => {
    const db = ctx.db;
    if (!db) return;
    const enqueued = await enqueueWebhookDeliveries(db, event, ctx.entryId);
    if (enqueued > 0) {
      ctx.log('webhooks-out: deliveries enqueued', { kind: event.kind, enqueued });
    }
  });
  return router;
}

// ─── 2. Delivery ticker ────────────────────────────────────────────────────

export interface WebhookTickOptions {
  db: Db;
  log?: (message: string, extra?: Record<string, unknown>) => void;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
  now?: () => Date;
}

export interface WebhookTickResult {
  claimed: number;
  delivered: number;
  retried: number;
  failedPermanent: number;
}

/**
 * Claim + attempt due deliveries. The claim is a wakeAt lease bump
 * (`findOneAndUpdate` pending && wakeAt<=now → wakeAt=now+90s) so a
 * crashed worker's claim simply expires; attempts are recorded on the
 * doc, and the outcome transition writes the final wakeAt/status.
 */
export async function tickWebhookDeliveries(
  options: WebhookTickOptions,
): Promise<WebhookTickResult> {
  const { db } = options;
  const log = options.log ?? (() => undefined);
  const fetchImpl = options.fetchImpl ?? fetch;
  const nowFn = options.now ?? (() => new Date());

  const result: WebhookTickResult = { claimed: 0, delivered: 0, retried: 0, failedPermanent: 0 };

  for (let i = 0; i < MAX_PER_TICK; i += 1) {
    const now = nowFn();
    const claimed = await deliveries(db).findOneAndUpdate(
      { status: 'pending', wakeAt: { $lte: now } },
      { $set: { wakeAt: new Date(now.getTime() + CLAIM_LEASE_MS) } },
      { sort: { wakeAt: 1 }, returnDocument: 'after' },
    );
    if (!claimed || !claimed._id) break;
    result.claimed += 1;

    const outcome = await attemptDelivery(db, claimed, { fetchImpl, now: nowFn });
    result[outcome] += 1;
    if (outcome !== 'delivered') {
      log('webhooks-out: attempt did not deliver', {
        deliveryId: claimed._id.toHexString(),
        event: claimed.event,
        outcome,
      });
    }
  }

  return result;
}

async function attemptDelivery(
  db: Db,
  delivery: WebhookDeliveryDoc,
  deps: { fetchImpl: typeof fetch; now: () => Date },
): Promise<'delivered' | 'retried' | 'failedPermanent'> {
  const attemptedAt = deps.now();
  const attempt: WebhookDeliveryAttempt = { attemptedAt, status: 0 };

  const hook = ObjectId.isValid(delivery.webhookId)
    ? await endpoints(db).findOne({ _id: new ObjectId(delivery.webhookId) })
    : null;

  if (!hook || !hook.isActive) {
    attempt.error = 'endpoint_missing_or_disabled';
    await finishAttempt(db, delivery, attempt, null, deps.now());
    return 'failedPermanent';
  }

  const rawBody = buildEventBody({
    id: delivery._id ? delivery._id.toHexString() : '',
    kind: delivery.event,
    payload: delivery.payload ?? {},
    at: delivery.eventAt ?? delivery.createdAt.getTime(),
  });

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS);
    let res: Response;
    try {
      res = await deps.fetchImpl(hook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'SabSMS-Webhook/1.0',
          ...signatureHeaders(hook.secret, rawBody, attemptedAt.getTime()),
        },
        body: rawBody,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    attempt.status = res.status;
    attempt.responseSnippet = (await res.text().catch(() => '')).slice(0, 256);
    if (res.ok) {
      await deliveries(db).updateOne(
        { _id: delivery._id },
        {
          $push: { attempts: attempt },
          $set: { status: 'delivered', deliveredAt: deps.now() },
          $unset: { wakeAt: '' },
        },
      );
      return 'delivered';
    }
  } catch (err) {
    attempt.error =
      err instanceof Error && err.name === 'AbortError'
        ? `timeout after ${ATTEMPT_TIMEOUT_MS}ms`
        : err instanceof Error
          ? err.message.slice(0, 256)
          : 'fetch failed';
  }

  const attemptsSoFar = (delivery.attempts?.length ?? 0) + 1;
  const next = nextAttemptAt(attemptsSoFar, deps.now());
  await finishAttempt(db, delivery, attempt, next, deps.now());
  return next ? 'retried' : 'failedPermanent';
}

async function finishAttempt(
  db: Db,
  delivery: WebhookDeliveryDoc,
  attempt: WebhookDeliveryAttempt,
  next: Date | null,
  now: Date,
): Promise<void> {
  if (next) {
    await deliveries(db).updateOne(
      { _id: delivery._id },
      { $push: { attempts: attempt }, $set: { status: 'pending', wakeAt: next } },
    );
  } else {
    await deliveries(db).updateOne(
      { _id: delivery._id },
      { $push: { attempts: attempt }, $set: { status: 'failed' }, $unset: { wakeAt: '' } },
    );
  }
  void now;
}
