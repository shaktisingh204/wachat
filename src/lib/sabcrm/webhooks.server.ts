import "server-only";

/**
 * SabCRM — outbound webhook subscriptions runtime (server-only).
 *
 * A "webhook subscription" lets one project (tenant) register an external HTTPS
 * endpoint that SabNode POSTs to whenever a subscribed SabCRM event fires. Each
 * subscription stores a target `url`, the set of `events` it cares about, and a
 * per-subscription `secret` used to HMAC-sign every delivery so the receiver can
 * verify authenticity.
 *
 * ## Design contracts
 *
 * - **Tenant-scoped**: every read and write is filtered by `projectId`. A
 *   subscription is never visible to, or dispatched for, another project.
 * - **Self-contained collection**: webhook subscriptions live in their own
 *   `sabcrm_webhooks` collection with its own idempotent index bootstrap
 *   ({@link ensureWebhookIndexes}). This keeps the feature additive — it does
 *   not modify the shared `db.ts` collection registry.
 * - **Signing reuse**: HMAC-SHA-256 signing and the retry/backoff delivery loop
 *   are reused verbatim from the platform-wide
 *   `@/lib/api-platform/webhooks` (`signPayload` / `deliverWebhook`) so the
 *   signature header convention (`X-SabNode-Signature: sha256=<hex>`) is
 *   identical across SabNode. SabCRM does not reinvent transport.
 * - **Best-effort delivery**: {@link dispatchWebhook} never throws and never
 *   blocks the data write that triggered it. Subscriptions are delivered
 *   concurrently; a failing endpoint only disables itself after the
 *   {@link MAX_CONSECUTIVE_FAILURES} threshold and bumps bookkeeping counters.
 * - **No `any`**: all Mongo-boundary casts go through `Record<string, unknown>`
 *   (consistent with every other server module in this lib).
 * - **server-only**: this module must never be imported from client code; the
 *   stored `secret` must never round-trip to the browser. The serialised
 *   {@link WebhookSubscription} shape redacts the secret by default.
 *
 * ## Event vocabulary
 *
 * The dispatch surface is intentionally small and stable:
 *   - `record.created`   — a record was created in any object.
 *   - `record.updated`   — a record's data changed.
 *   - `record.deleted`   — a record was removed.
 *   - `activity.created` — a timeline activity (note/task/call/…) was logged.
 *
 * Callers in `records.server.ts` / `activities.server.ts` fire these via
 * {@link dispatchWebhook} as a fire-and-forget side effect.
 */

import { ObjectId, type Collection, type Db, type Filter, type IndexDescription } from "mongodb";
import { createHmac, randomBytes } from "node:crypto";

import { connectToDatabase } from "@/lib/mongodb";
import { deliverWebhook, signPayload } from "@/lib/api-platform/webhooks";

/* -------------------------------------------------------------------------- */
/* Event vocabulary                                                            */
/* -------------------------------------------------------------------------- */

// The event vocabulary lives in a framework-neutral module so Client
// Components can import it without pulling this server-only file (Mongo +
// node:crypto) into the client bundle. Re-exported here for existing server
// callers.
export {
  SABCRM_WEBHOOK_EVENTS,
  isSabcrmWebhookEvent,
  type SabcrmWebhookEvent,
} from "./webhook-events";

/* -------------------------------------------------------------------------- */
/* Collection name + persisted document shape                                  */
/* -------------------------------------------------------------------------- */

/** Mongo collection holding all SabCRM outbound webhook subscriptions. */
export const SABCRM_WEBHOOKS_COLLECTION = "sabcrm_webhooks" as const;

/**
 * A persisted webhook subscription for one project.
 *
 * Mirrors the rest of the SabCRM persisted shapes: a native `_id: ObjectId`,
 * tenant scoping via `projectId`, and ISO-string timestamps. The `secret` is
 * stored in clear so it can sign outbound payloads, and is redacted from the
 * default serialised shape returned to callers.
 */
export interface SabcrmWebhookDoc {
  _id: ObjectId;
  projectId: string;
  /** Destination HTTPS endpoint. Validated to be a syntactically valid URL. */
  url: string;
  /** The subscribed events. Always a non-empty subset of {@link SABCRM_WEBHOOK_EVENTS}. */
  events: SabcrmWebhookEvent[];
  /** Per-subscription HMAC secret (clear-text; never serialised to the client). */
  secret: string;
  /** Optional human label shown in the management UI. */
  description?: string;
  /** When false the subscription is skipped by {@link dispatchWebhook}. */
  active: boolean;
  /** User id that created the subscription (audit). */
  createdBy: string;
  /** Number of consecutive failed deliveries; reset to 0 on any success. */
  failureCount: number;
  /** ISO timestamp of the last delivery attempt (success or failure), if any. */
  lastDeliveryAt?: string;
  /** HTTP status of the last delivery attempt, or null on transport error. */
  lastStatus?: number | null;
  /** Error string from the last failed delivery, if any. */
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

/* -------------------------------------------------------------------------- */
/* Public (serialised) shapes                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The client-facing shape of a webhook subscription.
 *
 * `_id` is always a hex string and the `secret` is redacted by default — only
 * {@link createWebhook} and {@link rotateWebhookSecret} surface the secret, and
 * only once, so the operator can store it. `hasSecret` lets the UI show a
 * "secret is set" affordance without ever transmitting the value.
 */
export interface WebhookSubscription {
  _id: string;
  projectId: string;
  url: string;
  events: SabcrmWebhookEvent[];
  description?: string;
  active: boolean;
  createdBy: string;
  failureCount: number;
  lastDeliveryAt?: string;
  lastStatus?: number | null;
  lastError?: string;
  /** Present (and equal to the clear-text secret) only on create / rotate. */
  secret?: string;
  /** Always present: whether a signing secret is configured. */
  hasSecret: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Input accepted by {@link createWebhook}. */
export interface CreateWebhookInput {
  url: string;
  events: SabcrmWebhookEvent[];
  description?: string;
  /** Defaults to true when omitted. */
  active?: boolean;
  /**
   * Optional caller-supplied secret. When omitted a cryptographically random
   * secret is generated and returned once on the created subscription.
   */
  secret?: string;
}

/** Fields that may be updated by {@link updateWebhook}. The secret is rotated separately. */
export interface UpdateWebhookPatch {
  url?: string;
  events?: SabcrmWebhookEvent[];
  description?: string;
  active?: boolean;
}

/* -------------------------------------------------------------------------- */
/* Tunables                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * After this many consecutive failed deliveries a subscription auto-disables
 * (`active: false`) so a permanently dead endpoint stops consuming retries on
 * every event. The operator re-enables it via {@link updateWebhook}.
 */
export const MAX_CONSECUTIVE_FAILURES = 10;

/** Bytes of entropy for an auto-generated subscription secret (-> 64 hex chars). */
const SECRET_BYTES = 32;

/* -------------------------------------------------------------------------- */
/* Collection accessor + index bootstrap                                       */
/* -------------------------------------------------------------------------- */

async function getDb(): Promise<Db> {
  const { db } = await connectToDatabase();
  return db;
}

/** Typed accessor for the `sabcrm_webhooks` collection. */
export async function sabcrmWebhooks(): Promise<Collection<SabcrmWebhookDoc>> {
  const db = await getDb();
  return db.collection<SabcrmWebhookDoc>(SABCRM_WEBHOOKS_COLLECTION);
}

let indexesEnsured = false;

/**
 * Idempotently ensures the webhook indexes exist. Runs once per process.
 *
 * • `{projectId, createdAt}`      — management list, newest first.
 * • `{projectId, active, events}` — the dispatch hot path: find every active
 *   subscription in a project that subscribes to a given event.
 */
export async function ensureWebhookIndexes(): Promise<void> {
  if (indexesEnsured) return;
  const col = await sabcrmWebhooks();
  await col.createIndexes([
    { key: { projectId: 1, createdAt: -1 } },
    { key: { projectId: 1, active: 1, events: 1 } },
  ] as IndexDescription[]);
  indexesEnsured = true;
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Validates a destination URL: must parse and use an http(s) scheme. Returns a
 * human-readable error string, or `undefined` when valid.
 */
function validateUrl(url: unknown): string | undefined {
  if (typeof url !== "string" || url.trim().length === 0) {
    return "url is required.";
  }
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return `Invalid url: "${String(url)}".`;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return "url must use the http or https scheme.";
  }
  return undefined;
}

/**
 * Validates an events array: must be a non-empty array of known events with no
 * duplicates. Returns the de-duplicated event list, or throws on invalid input.
 */
function normaliseEvents(events: unknown): SabcrmWebhookEvent[] {
  if (!Array.isArray(events) || events.length === 0) {
    throw new Error("events must be a non-empty array.");
  }
  const seen = new Set<SabcrmWebhookEvent>();
  for (const e of events) {
    if (!isSabcrmWebhookEvent(e)) {
      throw new Error(
        `Invalid event "${String(e)}". Must be one of: ${SABCRM_WEBHOOK_EVENTS.join(", ")}.`,
      );
    }
    seen.add(e);
  }
  return [...seen];
}

/** Generates a cryptographically random hex secret. */
function generateSecret(): string {
  return randomBytes(SECRET_BYTES).toString("hex");
}

/* -------------------------------------------------------------------------- */
/* Serialisation                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Maps a persisted doc to the client shape. By default the `secret` is redacted
 * (`hasSecret` reflects whether one is set). Pass `{ revealSecret: true }` only
 * on the create / rotate paths where the operator must capture the value once.
 */
function docToSubscription(
  doc: SabcrmWebhookDoc,
  opts?: { revealSecret?: boolean },
): WebhookSubscription {
  return {
    _id: doc._id.toHexString(),
    projectId: doc.projectId,
    url: doc.url,
    events: doc.events,
    description: doc.description,
    active: doc.active,
    createdBy: doc.createdBy,
    failureCount: doc.failureCount,
    lastDeliveryAt: doc.lastDeliveryAt,
    lastStatus: doc.lastStatus,
    lastError: doc.lastError,
    secret: opts?.revealSecret ? doc.secret : undefined,
    hasSecret: Boolean(doc.secret),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/* -------------------------------------------------------------------------- */
/* CRUD                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Lists all webhook subscriptions for a project, newest first. Secrets are
 * always redacted in this view.
 */
export async function listWebhooks(
  projectId: string,
): Promise<WebhookSubscription[]> {
  await ensureWebhookIndexes();
  const col = await sabcrmWebhooks();
  const docs = await col
    .find({ projectId } as Filter<SabcrmWebhookDoc>)
    .sort({ createdAt: -1 })
    .toArray();
  return docs.map((d) => docToSubscription(d));
}

/**
 * Fetches one subscription by id, scoped to the project. Secret redacted.
 * Returns `null` when the id is malformed or the subscription does not exist.
 */
export async function getWebhook(
  projectId: string,
  id: string,
): Promise<WebhookSubscription | null> {
  if (!ObjectId.isValid(id)) return null;
  const col = await sabcrmWebhooks();
  const doc = await col.findOne({
    _id: new ObjectId(id),
    projectId,
  } as Filter<SabcrmWebhookDoc>);
  return doc ? docToSubscription(doc) : null;
}

/**
 * Creates a webhook subscription for the project. When no `secret` is supplied a
 * random one is generated. The returned subscription includes the clear-text
 * `secret` exactly once so the operator can store it; subsequent reads redact it.
 *
 * @throws on invalid url / events.
 */
export async function createWebhook(
  projectId: string,
  createdBy: string,
  input: CreateWebhookInput,
): Promise<WebhookSubscription> {
  const urlError = validateUrl(input.url);
  if (urlError) throw new Error(urlError);
  const events = normaliseEvents(input.events);

  const secret =
    typeof input.secret === "string" && input.secret.trim().length > 0
      ? input.secret.trim()
      : generateSecret();

  const now = new Date().toISOString();
  const doc: Omit<SabcrmWebhookDoc, "_id"> = {
    projectId,
    url: input.url.trim(),
    events,
    secret,
    description: input.description?.trim() || undefined,
    active: input.active ?? true,
    createdBy,
    failureCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  await ensureWebhookIndexes();
  const col = await sabcrmWebhooks();
  const result = await col.insertOne(
    doc as unknown as Parameters<typeof col.insertOne>[0],
  );

  return docToSubscription({ ...doc, _id: result.insertedId } as SabcrmWebhookDoc, {
    revealSecret: true,
  });
}

/**
 * Applies a partial patch to a subscription (url / events / description /
 * active). The `secret` is rotated via {@link rotateWebhookSecret}, not here.
 *
 * Returns the updated subscription (secret redacted), or `null` if the id is
 * malformed / not found.
 *
 * @throws on invalid url / events in the patch.
 */
export async function updateWebhook(
  projectId: string,
  id: string,
  patch: UpdateWebhookPatch,
): Promise<WebhookSubscription | null> {
  if (!ObjectId.isValid(id)) return null;

  const set: Record<string, unknown> = { updatedAt: new Date().toISOString() };

  if (patch.url !== undefined) {
    const urlError = validateUrl(patch.url);
    if (urlError) throw new Error(urlError);
    set.url = patch.url.trim();
  }
  if (patch.events !== undefined) {
    set.events = normaliseEvents(patch.events);
  }
  if (patch.description !== undefined) {
    set.description = patch.description.trim() || undefined;
  }
  if (patch.active !== undefined) {
    set.active = patch.active;
    // Re-enabling a dead endpoint clears its failure streak.
    if (patch.active) set.failureCount = 0;
  }

  const col = await sabcrmWebhooks();
  const updated = await col.findOneAndUpdate(
    { _id: new ObjectId(id), projectId } as Filter<SabcrmWebhookDoc>,
    { $set: set },
    { returnDocument: "after" },
  );
  return updated ? docToSubscription(updated) : null;
}

/**
 * Rotates the signing secret for a subscription, returning the subscription with
 * the new clear-text `secret` exactly once. Returns `null` if not found.
 */
export async function rotateWebhookSecret(
  projectId: string,
  id: string,
): Promise<WebhookSubscription | null> {
  if (!ObjectId.isValid(id)) return null;
  const col = await sabcrmWebhooks();
  const updated = await col.findOneAndUpdate(
    { _id: new ObjectId(id), projectId } as Filter<SabcrmWebhookDoc>,
    { $set: { secret: generateSecret(), updatedAt: new Date().toISOString() } },
    { returnDocument: "after" },
  );
  return updated ? docToSubscription(updated, { revealSecret: true }) : null;
}

/**
 * Deletes a subscription, scoped to the project. Returns `true` when removed.
 */
export async function deleteWebhook(
  projectId: string,
  id: string,
): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false;
  const col = await sabcrmWebhooks();
  const result = await col.deleteOne({
    _id: new ObjectId(id),
    projectId,
  } as Filter<SabcrmWebhookDoc>);
  return result.deletedCount === 1;
}

/* -------------------------------------------------------------------------- */
/* Dispatch                                                                    */
/* -------------------------------------------------------------------------- */

/** The signed envelope POSTed to every subscribed endpoint. */
export interface WebhookEnvelope<P = unknown> {
  /** The event that fired. */
  event: SabcrmWebhookEvent;
  /** Owning project (tenant) id. */
  projectId: string;
  /** ISO timestamp of when the dispatch was assembled. */
  timestamp: string;
  /** Event-specific payload (record / activity snapshot). */
  data: P;
}

/** Per-subscription outcome returned by {@link dispatchWebhook}. */
export interface WebhookDispatchOutcome {
  webhookId: string;
  url: string;
  success: boolean;
  status: number | null;
  attempts: number;
  error?: string;
  /** True when this delivery pushed the subscription past the failure cap. */
  disabled: boolean;
}

/**
 * Dispatches `event` to every active subscription in `projectId` that subscribes
 * to it. Best-effort: this function never throws — the worst case is a resolved
 * array of failed outcomes. The triggering data write must NOT await-block on
 * this; call it fire-and-forget (e.g. `void dispatchWebhook(...)`).
 *
 * Each delivery:
 *   1. Wraps `payload` in a signed {@link WebhookEnvelope}.
 *   2. Reuses the platform `deliverWebhook` (HMAC-SHA-256 signature in the
 *      `X-SabNode-Signature` header, retry + exponential backoff).
 *   3. Updates the subscription's bookkeeping (`lastDeliveryAt`, `lastStatus`,
 *      `failureCount`) and auto-disables it after
 *      {@link MAX_CONSECUTIVE_FAILURES} consecutive failures.
 *
 * @param projectId tenant scope — only this project's subscriptions are fired.
 * @param event     one of {@link SABCRM_WEBHOOK_EVENTS}.
 * @param payload   event-specific data (record / activity snapshot).
 */
export async function dispatchWebhook(
  projectId: string,
  event: SabcrmWebhookEvent,
  payload: unknown,
): Promise<WebhookDispatchOutcome[]> {
  try {
    if (!projectId || !isSabcrmWebhookEvent(event)) return [];

    await ensureWebhookIndexes();
    const col = await sabcrmWebhooks();

    const subscriptions = await col
      .find({
        projectId,
        active: true,
        events: event,
      } as Filter<SabcrmWebhookDoc>)
      .toArray();

    if (subscriptions.length === 0) return [];

    const envelope: WebhookEnvelope = {
      event,
      projectId,
      timestamp: new Date().toISOString(),
      data: payload,
    };

    const outcomes = await Promise.all(
      subscriptions.map((sub) => deliverToSubscription(col, sub, event, envelope)),
    );
    return outcomes;
  } catch {
    // Best-effort: a dispatch-layer failure must never unwind the caller's write.
    return [];
  }
}

/**
 * Delivers a single envelope to one subscription and records the outcome.
 * Always resolves; never throws.
 */
async function deliverToSubscription(
  col: Collection<SabcrmWebhookDoc>,
  sub: SabcrmWebhookDoc,
  event: SabcrmWebhookEvent,
  envelope: WebhookEnvelope,
): Promise<WebhookDispatchOutcome> {
  const webhookId = sub._id.toHexString();
  try {
    const delivery = await deliverWebhook(sub.url, envelope, {
      secret: sub.secret,
      event,
      tenantId: sub.projectId,
      webhookId,
    });

    const now = new Date().toISOString();
    let disabled = false;

    if (delivery.success) {
      await col.updateOne(
        { _id: sub._id } as Filter<SabcrmWebhookDoc>,
        {
          $set: {
            failureCount: 0,
            lastDeliveryAt: now,
            lastStatus: delivery.responseStatus,
            lastError: undefined,
            updatedAt: now,
          },
        },
      );
    } else {
      const nextFailureCount = (sub.failureCount ?? 0) + 1;
      disabled = nextFailureCount >= MAX_CONSECUTIVE_FAILURES;
      const set: Record<string, unknown> = {
        failureCount: nextFailureCount,
        lastDeliveryAt: now,
        lastStatus: delivery.responseStatus,
        lastError: delivery.error ?? `HTTP ${String(delivery.responseStatus)}`,
        updatedAt: now,
      };
      if (disabled) set.active = false;
      await col.updateOne(
        { _id: sub._id } as Filter<SabcrmWebhookDoc>,
        { $set: set },
      );
    }

    return {
      webhookId,
      url: sub.url,
      success: delivery.success,
      status: delivery.responseStatus,
      attempts: delivery.attempts,
      error: delivery.error,
      disabled,
    };
  } catch (err) {
    // deliverWebhook is documented never to throw, but the bookkeeping update
    // can — swallow it so one bad subscription cannot fail the whole fan-out.
    return {
      webhookId,
      url: sub.url,
      success: false,
      status: null,
      attempts: 0,
      error: err instanceof Error ? err.message : "Webhook bookkeeping failed.",
      disabled: false,
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Signature helpers (re-exported for receivers / verification surfaces)       */
/* -------------------------------------------------------------------------- */

/**
 * Computes the `sha256=<hex>` signature SabCRM sends in `X-SabNode-Signature`
 * for a given envelope + secret. Thin wrapper over the platform `signPayload`
 * so SabCRM call-sites have a single import surface for webhook concerns.
 */
export function signWebhookPayload(secret: string, body: unknown): string {
  return signPayload(secret, body);
}

/**
 * Constant-time verification of an inbound `X-SabNode-Signature` header against
 * a body + secret. Useful for tests and any in-app receiver.
 */
export function verifyWebhookSignature(
  secret: string,
  body: unknown,
  signature: string,
): boolean {
  const message = typeof body === "string" ? body : JSON.stringify(body ?? null);
  const expected = `sha256=${createHmac("sha256", secret)
    .update(message, "utf8")
    .digest("hex")}`;
  if (expected.length !== signature.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return mismatch === 0;
}
