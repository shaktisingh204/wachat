/**
 * SabNode Developer Platform — shared types.
 *
 * These types power the public versioned API surface (`/api/v1/*`),
 * developer-issued API keys, OAuth applications, rate-limit tiers and
 * outbound webhook delivery.  They are deliberately framework-agnostic so
 * the same shapes can be reused by background workers and admin tooling.
 */

/* ── OAuth scopes ────────────────────────────────────────────────────────── */

/**
 * The complete catalogue of OAuth / API-key scopes recognised by the
 * platform.  Scopes are namespaced `<resource>:<action>` and are always
 * stored as a flat string array on a key/app.
 */
export type OAuthScope =
  | 'contacts:read'
  | 'contacts:write'
  | 'messages:read'
  | 'messages:write'
  | 'broadcasts:read'
  | 'broadcasts:write'
  | 'flows:read'
  | 'flows:write'
  | 'webhooks:read'
  | 'webhooks:write'
  | 'me:read'
  | '*';

/* ── Rate-limit tiers ────────────────────────────────────────────────────── */

/**
 * A subscription-driven rate-limit tier.  The numeric "requests per minute"
 * for each tier is centralised in `rate-limit.ts` so it can be tweaked
 * without touching every call-site.
 */
export type RateLimitTier = 'FREE' | 'PRO' | 'ENTERPRISE';

/* ── API keys ────────────────────────────────────────────────────────────── */

/**
 * An API key record stored in Mongo (`api_keys` collection).
 *
 * `key` is the **hashed** key (sha-256 hex).  The plain-text key is shown
 * exactly once at creation time and never persisted.  `prefix` is the
 * first 8 chars of the plain key (purely cosmetic — used for UI listings
 * such as "sk_live_4f9a…").
 */
export interface ApiKey {
  /** Mongo `_id` as hex string. */
  id: string;
  /** Owning tenant / workspace id. */
  tenantId: string;
  /** Human-readable label. */
  name: string;
  /** sha-256 hex digest of the plain-text key. */
  key: string;
  /** First 8 chars of the plain-text key (display only). */
  prefix: string;
  /** Granted scopes. */
  scopes: OAuthScope[];
  /** Subscription tier driving the rate limit. */
  tier: RateLimitTier;
  /** ISO timestamp when last used (null if never). */
  lastUsedAt: string | null;
  createdAt: string;
  /** True once the key has been revoked. */
  revoked: boolean;
}

/* ── OAuth applications ──────────────────────────────────────────────────── */

/**
 * A 3rd-party OAuth application registered with the platform.  Applications
 * may request scopes which users grant during the consent flow; the
 * issued access token inherits a subset of the requested scopes.
 */
export interface OAuthApp {
  id: string;
  /** The publishing tenant. */
  ownerTenantId: string;
  name: string;
  description?: string;
  /** Public client identifier. */
  clientId: string;
  /** sha-256 hex digest of the plain-text client secret. */
  clientSecretHash: string;
  /** Whitelisted redirect URIs. */
  redirectUris: string[];
  /** Scopes the app may request. */
  scopes: OAuthScope[];
  createdAt: string;
}

/* ── Webhooks ───────────────────────────────────────────────────────────── */

/**
 * An outbound webhook subscription registered by a tenant.  When matching
 * events fire, the platform POSTs a JSON payload to `url` signed with
 * `secret` (HMAC SHA-256, see `webhooks.ts`).
 */
export interface Webhook {
  id: string;
  tenantId: string;
  url: string;
  /** Shared secret used to sign payloads. */
  secret: string;
  /** Event names this hook subscribes to (e.g. `contact.created`). */
  events: string[];
  active: boolean;
  createdAt: string;
}

/**
 * A single delivery attempt for a webhook.  Persisted so that operators
 * can inspect failures and retries.
 */
export interface WebhookDelivery {
  id: string;
  webhookId: string;
  tenantId: string;
  event: string;
  payload: unknown;
  /** HTTP status returned by the receiver, or null on transport error. */
  responseStatus: number | null;
  /** Truncated response body (≤ 4 KB). */
  responseBody?: string;
  /** Number of attempts performed so far (1-based). */
  attempts: number;
  /** Whether the delivery ultimately succeeded. */
  success: boolean;
  /** Last error message, if any. */
  error?: string;
  /** ISO timestamp of the first attempt. */
  startedAt: string;
  /** ISO timestamp of the final attempt (success or last failure). */
  finishedAt: string;
}
