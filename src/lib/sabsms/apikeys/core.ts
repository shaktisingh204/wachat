/**
 * SabSMS developer keys — pure core (V2.13).
 *
 * Everything in this module is side-effect free and Node-only-stdlib so
 * the unit tests under `../__tests__/apikeys-core.test.ts` can run with
 * plain `tsx --test` (no Mongo, no `server-only`).
 *
 * Key format: `sk_live_<32 base62 chars>` — minted once, shown once.
 * Storage: sha-256 hex of the FULL raw key (`keyHash`) + the first 8
 * chars of the raw key as a display `prefix` ("sk_live_…" is 8 chars,
 * so the prefix shows `sk_live_` + nothing sensitive; we keep 12 chars
 * to make rows distinguishable: `sk_live_aB3x`).
 *
 * NOTE on "constant-time": the Mongo lookup is by hash equality (an
 * index seek — not an oracle on the raw key because sha-256 output is
 * uniform), and the explicit verification step uses
 * `crypto.timingSafeEqual` over the two hash buffers so no early-exit
 * string comparison ever touches key material.
 */

import { createHash, randomInt, timingSafeEqual } from 'node:crypto';

// ─── Scopes (client-safe half lives in ./scopes — re-exported here) ───────

export {
  SABSMS_API_SCOPES,
  hasScope,
  isSabsmsApiScope,
  type SabsmsApiScope,
} from './scopes';

// ─── Mint / hash ───────────────────────────────────────────────────────────

export const SABSMS_KEY_LIVE_PREFIX = 'sk_live_';
/**
 * V2.13 sandbox keys — `sk_test_…`. A test key authenticates exactly like
 * a live key (same scopes, rate limit, IP allowlist) but its `mode` is
 * threaded into the request so test-mode sends can be zero-rated / labelled
 * "test" downstream. Both prefixes are 8 chars, so the display prefix logic
 * is unchanged.
 */
export const SABSMS_KEY_TEST_PREFIX = 'sk_test_';

/** Live vs sandbox key. Absent on legacy docs → treated as 'live'. */
export type SabsmsApiKeyMode = 'live' | 'test';

/** All accepted raw-key prefixes (live first). */
export const SABSMS_KEY_PREFIXES = [SABSMS_KEY_LIVE_PREFIX, SABSMS_KEY_TEST_PREFIX] as const;

const BASE62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const KEY_RANDOM_LENGTH = 32;

/** The raw-key prefix for a given mode. */
export function prefixForMode(mode: SabsmsApiKeyMode): string {
  return mode === 'test' ? SABSMS_KEY_TEST_PREFIX : SABSMS_KEY_LIVE_PREFIX;
}

/**
 * The mode a raw key claims by its prefix (used by authentication, which
 * accepts both prefixes — see `authenticateApiKey`). Returns null when the
 * key carries no recognised prefix.
 */
export function modeFromRawKey(rawKey: string): SabsmsApiKeyMode | null {
  if (rawKey.startsWith(SABSMS_KEY_LIVE_PREFIX)) return 'live';
  if (rawKey.startsWith(SABSMS_KEY_TEST_PREFIX)) return 'test';
  return null;
}

/** Number of raw-key chars persisted for display ("sk_live_aB3x"). */
export const KEY_PREFIX_DISPLAY_LENGTH = 12;

export const DEFAULT_RATE_LIMIT_PER_MIN = 300;

/** sha-256 hex of a raw key. */
export function hashApiKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex');
}

/**
 * Mint a fresh key. `randomChar` is injectable for deterministic tests;
 * production uses crypto-grade `randomInt`. The optional `mode` selects
 * the prefix — `'live'` (default) → `sk_live_…`, `'test'` → `sk_test_…`.
 *
 * The `randomChar`-first signature is preserved for back-compat with the
 * existing unit tests (`mintApiKey(() => 'A')`).
 */
export function mintApiKey(
  randomChar: () => string = () => BASE62[randomInt(BASE62.length)],
  mode: SabsmsApiKeyMode = 'live',
): { rawKey: string; keyHash: string; prefix: string; mode: SabsmsApiKeyMode } {
  let random = '';
  for (let i = 0; i < KEY_RANDOM_LENGTH; i += 1) random += randomChar();
  const rawKey = `${prefixForMode(mode)}${random}`;
  return {
    rawKey,
    keyHash: hashApiKey(rawKey),
    prefix: rawKey.slice(0, KEY_PREFIX_DISPLAY_LENGTH),
    mode,
  };
}

/** Shape sanity: `sk_live_` + exactly 32 base62 chars. */
export function isWellFormedApiKey(rawKey: string): boolean {
  if (!rawKey.startsWith(SABSMS_KEY_LIVE_PREFIX)) return false;
  const random = rawKey.slice(SABSMS_KEY_LIVE_PREFIX.length);
  return random.length === KEY_RANDOM_LENGTH && /^[A-Za-z0-9]+$/.test(random);
}

/**
 * Shape sanity for EITHER a live or a test key: a recognised prefix +
 * exactly 32 base62 chars. (`isWellFormedApiKey` stays live-only so the
 * minted-shape invariant for production keys is unchanged.)
 */
export function isWellFormedAnyApiKey(rawKey: string): boolean {
  const mode = modeFromRawKey(rawKey);
  if (!mode) return false;
  const random = rawKey.slice(prefixForMode(mode).length);
  return random.length === KEY_RANDOM_LENGTH && /^[A-Za-z0-9]+$/.test(random);
}

/**
 * Constant-time comparison of a raw key against a stored sha-256 hex
 * hash. Both sides are re-derived to equal-length buffers before
 * `timingSafeEqual` (which throws on length mismatch).
 */
export function verifyApiKeyHash(rawKey: string, storedKeyHash: string): boolean {
  const candidate = Buffer.from(hashApiKey(rawKey), 'hex');
  const stored = Buffer.from(storedKeyHash || '', 'hex');
  if (candidate.length !== stored.length || stored.length === 0) return false;
  return timingSafeEqual(candidate, stored);
}

// ─── Authorisation decision (pure) ─────────────────────────────────────────

export interface SabsmsApiKeyDocLike {
  keyHash: string;
  scopes: string[];
  rateLimitPerMin?: number;
  ipAllowlist?: string[];
  revokedAt?: Date | null;
  /** Live vs sandbox. Absent on legacy docs → 'live'. */
  mode?: SabsmsApiKeyMode;
}

export type KeyAuthDecision =
  | { ok: true }
  | { ok: false; reason: 'bad_key' | 'revoked' | 'ip_blocked' };

/**
 * True when `ip` is allowed by the allowlist. Empty/absent allowlist =
 * any IP. Entries are exact IPs or simple prefix entries ending in `*`
 * or a trailing `.` (e.g. "10.0." or "10.0.*"). CIDR is intentionally
 * out of scope for v1.
 */
export function ipAllowed(ip: string, allowlist: readonly string[] | undefined): boolean {
  if (!allowlist || allowlist.length === 0) return true;
  const trimmed = (ip || '').trim();
  if (!trimmed) return false;
  for (const raw of allowlist) {
    const entry = (raw || '').trim();
    if (!entry) continue;
    if (entry.endsWith('*')) {
      if (trimmed.startsWith(entry.slice(0, -1))) return true;
    } else if (entry.endsWith('.')) {
      if (trimmed.startsWith(entry)) return true;
    } else if (trimmed === entry) {
      return true;
    }
  }
  return false;
}

/**
 * Full pure authorisation decision for one key doc: constant-time hash
 * check, revocation, IP allowlist. The caller (store) handles Mongo
 * lookup + lastUsedAt.
 */
export function authorizeKey(
  doc: SabsmsApiKeyDocLike,
  input: { rawKey: string; ip: string },
): KeyAuthDecision {
  if (!verifyApiKeyHash(input.rawKey, doc.keyHash)) return { ok: false, reason: 'bad_key' };
  if (doc.revokedAt) return { ok: false, reason: 'revoked' };
  if (!ipAllowed(input.ip, doc.ipAllowlist)) return { ok: false, reason: 'ip_blocked' };
  return { ok: true };
}

/** Clamp a user-supplied per-minute limit into a sane band. */
export function clampRateLimitPerMin(value: unknown): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_RATE_LIMIT_PER_MIN;
  return Math.min(Math.max(n, 1), 10_000);
}

/** Floor a date to its UTC minute (the `sabsms_api_usage` bucket key). */
export function minuteBucket(at: Date): Date {
  const t = at.getTime();
  return new Date(t - (t % 60_000));
}
