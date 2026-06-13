import 'server-only';

import { ObjectId, type Collection } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';

import {
  authorizeKey,
  clampRateLimitPerMin,
  hashApiKey,
  isSabsmsApiScope,
  minuteBucket,
  mintApiKey,
  modeFromRawKey,
  type SabsmsApiKeyMode,
  type SabsmsApiScope,
} from './core';

/**
 * SabSMS developer keys — Mongo store (V2.13).
 *
 * Collections:
 *   - `sabsms_api_keys`  — hashed scoped keys (raw key shown ONCE at mint)
 *   - `sabsms_api_usage` — per-(key, minute) request counters feeding the
 *     api-keys page sparkline. `$inc` upserts from the public-API wrapper,
 *     7-day TTL.
 *
 * Reuse note: a platform-wide key system exists (`src/lib/api-platform/`,
 * collection `api_keys`) but its keys are tier-rate-limited (FREE/PRO/…)
 * with a codegen'd scope catalogue and no per-key limits or IP
 * allowlists — all three are V2.13 requirements, so SabSMS keeps its own
 * key collection and reuses the platform's *idempotency* helper instead
 * (see `src/app/api/v1/sms/messages/route.ts`).
 */

export const SABSMS_API_KEYS_COLLECTION = 'sabsms_api_keys';
export const SABSMS_API_USAGE_COLLECTION = 'sabsms_api_usage';

/** Throttle for the best-effort `lastUsedAt` bump. */
const LAST_USED_MIN_INTERVAL_MS = 60_000;

const USAGE_TTL_DAYS = 7;

export interface SabsmsApiKeyDoc {
  _id?: ObjectId;
  workspaceId: string;
  name: string;
  /** sha-256 hex of the full raw key. */
  keyHash: string;
  /** First chars of the raw key, display only ("sk_live_aB3x"). */
  prefix: string;
  scopes: SabsmsApiScope[];
  rateLimitPerMin: number;
  ipAllowlist?: string[];
  /**
   * V2.13 — live vs sandbox key. Absent on keys minted before test mode
   * existed → treated as `'live'` everywhere it is read.
   */
  mode?: SabsmsApiKeyMode;
  lastUsedAt?: Date;
  revokedAt?: Date | null;
  createdAt: Date;
}

export interface SabsmsApiUsageDoc {
  _id?: ObjectId;
  keyId: string;
  /** UTC minute bucket. */
  minute: Date;
  count: number;
}

interface Handles {
  keys: Collection<SabsmsApiKeyDoc>;
  usage: Collection<SabsmsApiUsageDoc>;
}

let indexesEnsured = false;

async function handles(): Promise<Handles> {
  const { db } = await connectToDatabase();
  const keys = db.collection<SabsmsApiKeyDoc>(SABSMS_API_KEYS_COLLECTION);
  const usage = db.collection<SabsmsApiUsageDoc>(SABSMS_API_USAGE_COLLECTION);
  if (!indexesEnsured) {
    indexesEnsured = true;
    void Promise.all([
      keys.createIndex({ keyHash: 1 }, { unique: true }),
      keys.createIndex({ workspaceId: 1, createdAt: -1 }),
      usage.createIndex({ keyId: 1, minute: 1 }, { unique: true }),
      usage.createIndex({ minute: 1 }, { expireAfterSeconds: USAGE_TTL_DAYS * 24 * 60 * 60 }),
    ]).catch(() => {
      indexesEnsured = false;
    });
  }
  return { keys, usage };
}

// ─── Mint / list / revoke ──────────────────────────────────────────────────

export interface CreatedApiKey {
  id: string;
  /** Full raw key — shown ONCE, never persisted. */
  rawKey: string;
  prefix: string;
  mode: SabsmsApiKeyMode;
}

export async function createSabsmsApiKey(input: {
  workspaceId: string;
  name: string;
  scopes: string[];
  rateLimitPerMin?: unknown;
  ipAllowlist?: string[];
  /** `'test'` mints a `sk_test_…` sandbox key; defaults to `'live'`. */
  mode?: SabsmsApiKeyMode;
}): Promise<CreatedApiKey> {
  const scopes = [...new Set(input.scopes)].filter(isSabsmsApiScope);
  if (scopes.length === 0) throw new Error('At least one valid scope is required');

  const mode: SabsmsApiKeyMode = input.mode === 'test' ? 'test' : 'live';
  const minted = mintApiKey(undefined, mode);
  const { keys } = await handles();
  const _id = new ObjectId();
  await keys.insertOne({
    _id,
    workspaceId: input.workspaceId,
    name: input.name.trim() || 'Untitled key',
    keyHash: minted.keyHash,
    prefix: minted.prefix,
    scopes,
    rateLimitPerMin: clampRateLimitPerMin(input.rateLimitPerMin),
    ipAllowlist: (input.ipAllowlist ?? [])
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 32),
    mode,
    revokedAt: null,
    createdAt: new Date(),
  });
  return { id: _id.toHexString(), rawKey: minted.rawKey, prefix: minted.prefix, mode };
}

export async function listSabsmsApiKeys(workspaceId: string): Promise<SabsmsApiKeyDoc[]> {
  const { keys } = await handles();
  return keys.find({ workspaceId }).sort({ createdAt: -1 }).limit(200).toArray();
}

export async function revokeSabsmsApiKey(
  workspaceId: string,
  keyId: string,
): Promise<boolean> {
  if (!ObjectId.isValid(keyId)) return false;
  const { keys } = await handles();
  const res = await keys.updateOne(
    { _id: new ObjectId(keyId), workspaceId, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
  return res.modifiedCount === 1;
}

// ─── Authentication ────────────────────────────────────────────────────────

export interface AuthenticatedApiKey {
  workspaceId: string;
  scopes: SabsmsApiScope[];
  keyId: string;
  rateLimitPerMin: number;
  /**
   * Live vs sandbox. Threaded through `withSabsmsApi` so handlers can
   * zero-rate / label test-mode traffic. Legacy keys (no stored mode)
   * resolve to `'live'`.
   */
  mode: SabsmsApiKeyMode;
}

function extractBearer(req: Request): string | null {
  const authz = req.headers.get('authorization');
  if (!authz) return null;
  const m = /^Bearer\s+(.+)$/i.exec(authz.trim());
  return m ? m[1].trim() : null;
}

export function clientIpOf(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) {
    const first = fwd.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.headers.get('x-real-ip')?.trim() ?? '';
}

/**
 * Authenticate a public-API request via `Authorization: Bearer sk_live_…`
 * OR `sk_test_…` (V2.13 sandbox keys). Both prefixes go through the same
 * checks; the resolved `mode` is returned to the caller.
 *
 *   - constant-time hash verification ([`verifyApiKeyHash`])
 *   - revoked keys rejected
 *   - IP allowlist enforced when configured
 *   - `lastUsedAt` bumped fire-and-forget, at most once per 60 s
 *
 * Returns `null` for ANY failure — callers respond 401 without leaking
 * which check failed.
 */
export async function authenticateApiKey(req: Request): Promise<AuthenticatedApiKey | null> {
  const rawKey = extractBearer(req);
  if (!rawKey || modeFromRawKey(rawKey) === null) return null;

  let doc: SabsmsApiKeyDoc | null;
  try {
    const { keys } = await handles();
    doc = await keys.findOne({ keyHash: hashApiKey(rawKey) });
  } catch (err) {
    console.error('[sabsms/apikeys] authenticate lookup failed', err);
    return null;
  }
  if (!doc || !doc._id) return null;

  const decision = authorizeKey(doc, { rawKey, ip: clientIpOf(req) });
  if (!decision.ok) return null;

  // Throttled lastUsedAt bump — never blocks the request.
  const now = new Date();
  if (!doc.lastUsedAt || now.getTime() - doc.lastUsedAt.getTime() >= LAST_USED_MIN_INTERVAL_MS) {
    void handles()
      .then(({ keys }) =>
        keys.updateOne(
          {
            _id: doc!._id,
            $or: [
              { lastUsedAt: { $exists: false } },
              { lastUsedAt: { $lte: new Date(now.getTime() - LAST_USED_MIN_INTERVAL_MS) } },
            ],
          },
          { $set: { lastUsedAt: now } },
        ),
      )
      .catch(() => undefined);
  }

  // The stored doc mode is authoritative; fall back to the prefix the raw
  // key carried (legacy live keys have no stored mode).
  const mode: SabsmsApiKeyMode = doc.mode ?? modeFromRawKey(rawKey) ?? 'live';

  return {
    workspaceId: doc.workspaceId,
    scopes: doc.scopes,
    keyId: doc._id.toHexString(),
    rateLimitPerMin: clampRateLimitPerMin(doc.rateLimitPerMin),
    mode,
  };
}

// ─── Usage counters ────────────────────────────────────────────────────────

/** `$inc`-upsert one request into the (key, minute) bucket. Best-effort. */
export async function recordApiUsage(keyId: string, at: Date = new Date()): Promise<void> {
  try {
    const { usage } = await handles();
    await usage.updateOne(
      { keyId, minute: minuteBucket(at) },
      { $inc: { count: 1 } },
      { upsert: true },
    );
  } catch (err) {
    console.warn('[sabsms/apikeys] usage record failed (ignored)', err);
  }
}

/**
 * Hourly request counts for the last `hours` (default 24) — feeds the
 * per-key sparkline on the api-keys page. Returns oldest → newest.
 */
export async function usageSparkline(
  keyId: string,
  hours = 24,
): Promise<Array<{ hour: string; count: number }>> {
  const { usage } = await handles();
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  const docs = await usage
    .find({ keyId, minute: { $gte: since } })
    .project<{ minute: Date; count: number }>({ minute: 1, count: 1 })
    .toArray();

  const byHour = new Map<string, number>();
  for (let i = hours - 1; i >= 0; i -= 1) {
    const d = new Date(Date.now() - i * 60 * 60 * 1000);
    byHour.set(hourKey(d), 0);
  }
  for (const doc of docs) {
    const key = hourKey(doc.minute);
    if (byHour.has(key)) byHour.set(key, (byHour.get(key) ?? 0) + (doc.count || 0));
  }
  return [...byHour.entries()].map(([hour, count]) => ({ hour, count }));
}

function hourKey(d: Date): string {
  return d.toISOString().slice(0, 13);
}
