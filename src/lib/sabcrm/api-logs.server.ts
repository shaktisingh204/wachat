import "server-only";

/**
 * SabCRM — public REST API platform: request logging + rate limiting (server).
 *
 * Two responsibilities, both backed by Mongo and both best-effort (a downed DB
 * must never break the API request they instrument):
 *
 *   1. {@link logApiCall} — append one access-log row to `sabcrm_api_logs`. The
 *      row is shaped by the pure {@link shapeApiLog} helper (verb whitelisted,
 *      path query-stripped + truncated, numerics clamped) so a hostile request
 *      line can't bloat the collection. A TTL index expires rows automatically.
 *
 *   2. {@link checkRateLimit} — a fixed-window per-key limiter. Each key gets a
 *      bucket `{ keyId, window }` in `sabcrm_api_ratelimit`; an atomic `$inc`
 *      with upsert returns the running count for the current window, which the
 *      pure {@link rateLimitVerdict} evaluator turns into an allow/deny verdict
 *      plus the standard `RateLimit-*` headers. The bucket carries an expiry so
 *      old windows are reaped by the same TTL monitor.
 *
 * Both collections are SabCRM-owned (`sabcrm_api_*`) and manage their own
 * indexes idempotently, mirroring `apikeys.server.ts` — they intentionally do
 * NOT extend the shared `db.ts` index runner.
 *
 * The per-key cap is resolved from the project's plan tier via the existing
 * `limits.server` ladder so heavier plans get a higher ceiling, with no new
 * config surface.
 */

import { ObjectId, type Collection } from "mongodb";

import { connectToDatabase } from "@/lib/mongodb";
import { resolveProjectTier, type SabcrmTier } from "./limits.server";
import {
  DEFAULT_RATE_LIMIT,
  RATE_LIMIT_WINDOW_MS,
  rateLimitVerdict,
  shapeApiLog,
  windowIdFor,
  windowResetAt,
  type ApiLogInput,
  type RateLimitVerdict,
} from "./api-logs";

export {
  rateLimitHeaders,
  rateLimitVerdict,
  shapeApiLog,
  MAX_BULK_BATCH,
  isBulkOp,
  type BulkOp,
  type ApiLogInput,
  type RateLimitVerdict,
  type ShapedApiLog,
} from "./api-logs";

/* ------------------------------------------------------------------ *
 * Collections
 * ------------------------------------------------------------------ */

/** Access-log collection. Project-scoped; TTL-expired. */
export const SABCRM_API_LOGS_COLLECTION = "sabcrm_api_logs";
/** Rate-limit bucket collection. Keyed by `{ keyId, window }`; TTL-expired. */
export const SABCRM_API_RATELIMIT_COLLECTION = "sabcrm_api_ratelimit";

/** How long access-log rows are retained before the TTL monitor reaps them. */
const LOG_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

/** Persisted access-log document. */
interface ApiLogDoc {
  _id: ObjectId;
  projectId: string;
  keyId: string;
  method: string;
  path: string;
  status: number;
  ms: number;
  /** Set so the TTL index can expire the row. */
  createdAt: Date;
}

/** Persisted rate-limit bucket. One per `{ keyId, window }`. */
interface RateLimitDoc {
  _id: string; // `${keyId}:${window}`
  keyId: string;
  window: number;
  count: number;
  /** Set so the TTL index can reap stale windows. */
  expiresAt: Date;
}

/* ------------------------------------------------------------------ *
 * Per-tier rate-limit ladder
 * ------------------------------------------------------------------ */

/**
 * Requests-per-window cap by plan tier. Reuses the existing `limits.server`
 * tier ladder so the API limiter scales with the plan (no new config surface).
 * The free row exists only as a safe fallback (API access is access-gated off
 * on free elsewhere); it still permits *some* throughput so a misconfigured
 * plan degrades gracefully rather than 429-ing every call.
 */
const RATE_LIMIT_BY_TIER: Record<SabcrmTier, number> = {
  free: 120,
  starter: 600,
  pro: 3_000,
  business: 12_000,
  enterprise: 60_000,
};

/** Resolve the per-window request cap for a project from its plan tier. */
export async function resolveRateLimit(projectId: string): Promise<number> {
  try {
    const tier = await resolveProjectTier(projectId);
    return RATE_LIMIT_BY_TIER[tier] ?? DEFAULT_RATE_LIMIT;
  } catch {
    return DEFAULT_RATE_LIMIT;
  }
}

/* ------------------------------------------------------------------ *
 * Index management (idempotent, self-owned)
 * ------------------------------------------------------------------ */

let logIndexesEnsured = false;
let rateLimitIndexesEnsured = false;

/**
 * Ensure the access-log collection's indexes exist: a project/time index for
 * the admin log view, and a TTL index that auto-expires rows after
 * {@link LOG_TTL_SECONDS}. Idempotent + memoised per process.
 */
export async function ensureApiLogIndex(): Promise<void> {
  if (logIndexesEnsured) return;
  try {
    const { db } = await connectToDatabase();
    const col = db.collection<ApiLogDoc>(SABCRM_API_LOGS_COLLECTION);
    await Promise.all([
      col.createIndex({ projectId: 1, createdAt: -1 }, { background: true }),
      col.createIndex({ keyId: 1, createdAt: -1 }, { background: true }),
      col.createIndex(
        { createdAt: 1 },
        { background: true, expireAfterSeconds: LOG_TTL_SECONDS },
      ),
    ]);
    logIndexesEnsured = true;
  } catch (err) {
    console.error("[sabcrm:api] ensureApiLogIndex failed:", err);
  }
}

async function logsCollection(): Promise<Collection<ApiLogDoc>> {
  const { db } = await connectToDatabase();
  await ensureApiLogIndex();
  return db.collection<ApiLogDoc>(SABCRM_API_LOGS_COLLECTION);
}

async function rateLimitCollection(): Promise<Collection<RateLimitDoc>> {
  const { db } = await connectToDatabase();
  const col = db.collection<RateLimitDoc>(SABCRM_API_RATELIMIT_COLLECTION);
  if (!rateLimitIndexesEnsured) {
    try {
      await col.createIndex(
        { expiresAt: 1 },
        { background: true, expireAfterSeconds: 0 },
      );
      rateLimitIndexesEnsured = true;
    } catch (err) {
      console.error("[sabcrm:api] rate-limit index ensure failed:", err);
    }
  }
  return col;
}

/* ------------------------------------------------------------------ *
 * Logging
 * ------------------------------------------------------------------ */

/**
 * Append one access-log row for a completed public-API request. Best-effort:
 * never throws and never blocks the caller (failures are swallowed + logged).
 * Shape/clamp/truncate is delegated to the pure {@link shapeApiLog}.
 */
export async function logApiCall(input: ApiLogInput): Promise<void> {
  try {
    const shaped = shapeApiLog(input);
    if (!shaped.projectId && !shaped.keyId) return; // nothing to attribute
    const col = await logsCollection();
    await col.insertOne({
      _id: new ObjectId(),
      ...shaped,
      createdAt: new Date(),
    });
  } catch (err) {
    console.error("[sabcrm:api] logApiCall failed:", err);
  }
}

/* ------------------------------------------------------------------ *
 * Rate limiting
 * ------------------------------------------------------------------ */

/**
 * Fixed-window rate-limit check for one API key.
 *
 * Atomically increments the `{ keyId, window }` bucket (upserting it for a new
 * window) and feeds the running count into the pure {@link rateLimitVerdict}.
 * The bucket's `expiresAt` is set one window into the future so the TTL monitor
 * reaps it once the window has fully passed.
 *
 * The cap defaults to the project's plan-tier ceiling (via
 * {@link resolveRateLimit}); pass an explicit `limit` to override.
 *
 * Best-effort + fail-OPEN: a DB error returns an `allowed: true` verdict at the
 * configured cap, so a transient datastore blip can never lock a tenant out of
 * their own API. (Abuse is still bounded by the per-record plan caps the route
 * enforces independently.)
 */
export async function checkRateLimit(
  keyId: string,
  options: { projectId?: string; limit?: number; now?: number } = {},
): Promise<RateLimitVerdict> {
  const now = options.now ?? Date.now();
  const limit =
    options.limit ??
    (options.projectId
      ? await resolveRateLimit(options.projectId)
      : DEFAULT_RATE_LIMIT);

  if (!keyId) {
    // Nothing to key on — allow, but report the cap so headers stay coherent.
    return rateLimitVerdict(1, limit, now);
  }

  const window = windowIdFor(now);

  try {
    const col = await rateLimitCollection();
    const doc = await col.findOneAndUpdate(
      { _id: `${keyId}:${window}` },
      {
        $inc: { count: 1 },
        $setOnInsert: {
          keyId,
          window,
          // Keep the bucket until one full window past this window's end.
          expiresAt: new Date(windowResetAt(now) + RATE_LIMIT_WINDOW_MS),
        },
      },
      { upsert: true, returnDocument: "after" },
    );
    const count = doc?.count ?? 1;
    return rateLimitVerdict(count, limit, now);
  } catch (err) {
    console.error("[sabcrm:api] checkRateLimit failed (failing open):", err);
    // Fail open: report the first slot as used so headers are sane.
    return rateLimitVerdict(1, limit, now);
  }
}
