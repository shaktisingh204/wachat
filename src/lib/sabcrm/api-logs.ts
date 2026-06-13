/**
 * SabCRM — public REST API platform: PURE helpers.
 *
 * This module holds the side-effect-free parts of the API platform's
 * logging + rate-limiting layer so they can be unit-tested in isolation
 * (no Mongo, no `server-only`) and reused from both the server module
 * (`./api-logs.server`) and tests.
 *
 * The server module (`./api-logs.server`) imports everything here and adds the
 * Mongo persistence + the fixed-window rate-limit counter.
 *
 * Design notes
 * ------------
 *   • Log shaping (`shapeApiLog`) is deterministic and total — it never throws,
 *     clamps numeric fields into sane bounds, normalises the HTTP verb, and
 *     truncates the path so a hostile/oversized request line can't bloat the
 *     `sabcrm_api_logs` collection.
 *   • Rate-limit math (`rateLimitVerdict`) is a pure fixed-window evaluator: it
 *     takes the current count in the window + the cap and returns the verdict
 *     plus the standard rate-limit headers. The server module owns the atomic
 *     counter increment; this module owns the policy.
 */

/* ------------------------------------------------------------------ *
 * Rate-limit policy
 * ------------------------------------------------------------------ */

/**
 * Fixed-window length in milliseconds. One bucket per key per window; the
 * window id is `floor(now / WINDOW_MS)`. A short window keeps a stuck/abusive
 * key from starving a tenant for long while still smoothing real bursts.
 */
export const RATE_LIMIT_WINDOW_MS = 60_000;

/** Default requests-per-window allowed for a single API key. */
export const DEFAULT_RATE_LIMIT = 600;

/** Hard floor/ceiling so a misconfigured cap can never disable or unbound the limiter. */
const MIN_RATE_LIMIT = 1;
const MAX_RATE_LIMIT = 1_000_000;

/** Max stored request-path length (chars) — longer paths are truncated. */
export const MAX_LOGGED_PATH = 512;

/** The HTTP verbs the public API recognises; anything else is logged as `OTHER`. */
const KNOWN_METHODS = new Set([
  "GET",
  "POST",
  "PATCH",
  "PUT",
  "DELETE",
  "HEAD",
  "OPTIONS",
]);

/* ------------------------------------------------------------------ *
 * Log shaping
 * ------------------------------------------------------------------ */

/** Caller-supplied input to {@link shapeApiLog} / `logApiCall`. */
export interface ApiLogInput {
  projectId: string;
  keyId: string;
  method: string;
  path: string;
  status: number;
  /** Wall-clock duration of the request handler, in milliseconds. */
  ms: number;
}

/** The normalised, persistence-ready log row (sans `_id` / `createdAt`). */
export interface ShapedApiLog {
  projectId: string;
  keyId: string;
  /** Upper-cased, whitelisted HTTP verb (or `OTHER`). */
  method: string;
  /** Path only (query string stripped), truncated to {@link MAX_LOGGED_PATH}. */
  path: string;
  /** HTTP status clamped into `[100, 599]`. */
  status: number;
  /** Non-negative integer milliseconds. */
  ms: number;
}

/** Clamp a value into `[min, max]`, defaulting non-finite input to `min`. */
function clampInt(value: unknown, min: number, max: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** Normalise an HTTP method to an upper-cased known verb, or `OTHER`. */
export function normaliseMethod(method: unknown): string {
  const up = String(method ?? "").trim().toUpperCase();
  return KNOWN_METHODS.has(up) ? up : "OTHER";
}

/**
 * Strip the query string + fragment from a request path and truncate it to
 * {@link MAX_LOGGED_PATH}. Accepts either a bare path (`/api/...`) or a full
 * URL (`https://host/api/...?q=1`) and always returns just the path component.
 * Never throws — falls back to a best-effort string slice on parse failure.
 */
export function normalisePath(path: unknown): string {
  let raw = String(path ?? "").trim();
  if (!raw) return "/";
  // If a full URL was passed, keep only its pathname.
  if (/^https?:\/\//i.test(raw)) {
    try {
      raw = new URL(raw).pathname;
    } catch {
      /* fall through to manual stripping */
    }
  }
  // Drop query string + fragment.
  const q = raw.indexOf("?");
  if (q !== -1) raw = raw.slice(0, q);
  const h = raw.indexOf("#");
  if (h !== -1) raw = raw.slice(0, h);
  if (!raw) raw = "/";
  return raw.length > MAX_LOGGED_PATH ? raw.slice(0, MAX_LOGGED_PATH) : raw;
}

/**
 * Deterministically shape a raw {@link ApiLogInput} into a persistence-ready
 * row. Total + side-effect-free: numeric fields are clamped, the verb is
 * whitelisted, and the path is query-stripped + truncated. The server module
 * adds `_id` + `createdAt` and inserts the result.
 */
export function shapeApiLog(input: ApiLogInput): ShapedApiLog {
  return {
    projectId: String(input.projectId ?? ""),
    keyId: String(input.keyId ?? ""),
    method: normaliseMethod(input.method),
    path: normalisePath(input.path),
    status: clampInt(input.status, 100, 599),
    ms: clampInt(input.ms, 0, Number.MAX_SAFE_INTEGER),
  };
}

/* ------------------------------------------------------------------ *
 * Rate-limit math (fixed window)
 * ------------------------------------------------------------------ */

/** Verdict + standard headers produced by {@link rateLimitVerdict}. */
export interface RateLimitVerdict {
  /** Whether THIS request is allowed (i.e. its post-increment count is within cap). */
  allowed: boolean;
  /** Configured cap for the window. */
  limit: number;
  /** Requests remaining in the current window after this one (never negative). */
  remaining: number;
  /** Epoch-ms at which the current window resets (start of next window). */
  resetAt: number;
  /** Seconds the client should wait before retrying (0 when allowed). */
  retryAfterSeconds: number;
}

/** Coerce a caller-supplied cap into a sane, enforced bound. */
export function clampRateLimit(limit?: number): number {
  return clampInt(limit ?? DEFAULT_RATE_LIMIT, MIN_RATE_LIMIT, MAX_RATE_LIMIT);
}

/** The fixed-window id for an instant — `floor(now / WINDOW_MS)`. */
export function windowIdFor(
  nowMs: number,
  windowMs: number = RATE_LIMIT_WINDOW_MS,
): number {
  const span = windowMs > 0 ? windowMs : RATE_LIMIT_WINDOW_MS;
  return Math.floor((Number.isFinite(nowMs) ? nowMs : 0) / span);
}

/** Epoch-ms at which the window containing `nowMs` ends (next window start). */
export function windowResetAt(
  nowMs: number,
  windowMs: number = RATE_LIMIT_WINDOW_MS,
): number {
  const span = windowMs > 0 ? windowMs : RATE_LIMIT_WINDOW_MS;
  return (windowIdFor(nowMs, span) + 1) * span;
}

/**
 * Pure fixed-window verdict.
 *
 * `countInWindow` is the running request count for the key in the current
 * window INCLUDING the request being evaluated (i.e. the value returned by an
 * atomic increment). A request is allowed when that count does not exceed the
 * cap. Returns the verdict plus the values needed to emit the standard
 * `RateLimit-*` / `Retry-After` headers.
 */
export function rateLimitVerdict(
  countInWindow: number,
  limit: number,
  nowMs: number,
  windowMs: number = RATE_LIMIT_WINDOW_MS,
): RateLimitVerdict {
  const cap = clampRateLimit(limit);
  const count = clampInt(countInWindow, 0, Number.MAX_SAFE_INTEGER);
  const allowed = count <= cap;
  const remaining = Math.max(0, cap - count);
  const resetAt = windowResetAt(nowMs, windowMs);
  const retryAfterSeconds = allowed
    ? 0
    : Math.max(1, Math.ceil((resetAt - nowMs) / 1000));
  return { allowed, limit: cap, remaining, resetAt, retryAfterSeconds };
}

/** Standard rate-limit response headers for a {@link RateLimitVerdict}. */
export function rateLimitHeaders(v: RateLimitVerdict): Record<string, string> {
  const headers: Record<string, string> = {
    "RateLimit-Limit": String(v.limit),
    "RateLimit-Remaining": String(v.remaining),
    "RateLimit-Reset": String(Math.max(0, Math.ceil((v.resetAt - Date.now()) / 1000))),
    "X-RateLimit-Limit": String(v.limit),
    "X-RateLimit-Remaining": String(v.remaining),
  };
  if (!v.allowed) headers["Retry-After"] = String(v.retryAfterSeconds);
  return headers;
}

/* ------------------------------------------------------------------ *
 * Bulk-batch policy
 * ------------------------------------------------------------------ */

/** Hard cap on the number of records accepted in one bulk request. */
export const MAX_BULK_BATCH = 200;

/** The recognised bulk operations. */
export type BulkOp = "create" | "update" | "delete";

/** Whether a string is a recognised {@link BulkOp}. */
export function isBulkOp(value: unknown): value is BulkOp {
  return value === "create" || value === "update" || value === "delete";
}
