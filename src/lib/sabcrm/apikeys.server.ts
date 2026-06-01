import "server-only";

/**
 * SabCRM — public REST API keys (server-only).
 *
 * Issues, lists and revokes the bearer tokens that authenticate the SabCRM
 * public REST routes (the headless API surface that lives outside the
 * session-cookie + RBAC pipeline used by the in-app server actions). A key
 * authenticates one tenant (`projectId`); every read/write performed through
 * a key is scoped to that project exactly as the in-app actions scope to
 * `gate().ctx.projectId`.
 *
 * SabNode already ships a generic developer-platform key store
 * (`src/lib/api-platform/auth.ts`, collection `api_keys`, scope-based) and a
 * per-user SabFlow store (`src/lib/sabflow/apiKeys`). Neither is tenant-scoped
 * by `projectId` the way SabCRM needs (api-platform keys carry OAuth scopes +
 * rate-limit tiers and key on `tenantId`; SabFlow keys are per-`userId`). To
 * keep SabCRM self-contained and avoid coupling its public API to the wider
 * platform's scope model, SabCRM owns its own collection — `sabcrm_api_keys` —
 * mirroring the same hashing scheme (SHA-256 hex, raw key shown exactly once,
 * never persisted in clear text).
 *
 * Security model:
 *   • The raw key is generated from 32 bytes of CSPRNG entropy and returned to
 *     the caller a single time at creation. Only its SHA-256 hex digest is
 *     persisted, so a leaked DB dump cannot be replayed against the API.
 *   • Lookup is by the unique-indexed `hash` column — O(1), constant-shape.
 *     The key material has enough entropy that a hash match is the auth proof;
 *     no per-row secret comparison is needed (same rationale as the existing
 *     `api-platform` / SabFlow stores).
 *   • Revoked keys are kept (soft-revoke via `revokedAt`) for audit, and the
 *     verify path filters them out, so a revoked key can never authenticate.
 *
 * Collection: `sabcrm_api_keys`
 *   { _id, projectId, hash, prefix, label, createdBy,
 *     createdAt, lastUsedAt?, revokedAt?, revokedBy? }
 *
 * This module manages its own indexes idempotently (it does not extend the
 * shared `db.ts` index runner, which is owned elsewhere) so a fresh tenant
 * works on first call.
 */

import { createHash, randomBytes } from "node:crypto";
import { type Collection, ObjectId } from "mongodb";

import { connectToDatabase } from "@/lib/mongodb";

/* ------------------------------------------------------------------ *
 * Constants
 * ------------------------------------------------------------------ */

/** Mongo collection name. Tenant-scoped by `projectId`. */
export const SABCRM_API_KEYS_COLLECTION = "sabcrm_api_keys";

/**
 * Public, human-recognisable prefix on every minted key. Lets API consumers
 * (and our UI) eyeball that a string is a SabCRM key without leaking the
 * secret. The displayed `prefix` below combines this with the first few
 * random characters so keys are visually distinguishable in a list.
 */
export const SABCRM_API_KEY_PREFIX = "sk_crm_";

/** Bytes of CSPRNG entropy behind each key (base64url-encoded). */
const KEY_ENTROPY_BYTES = 32;

/* ------------------------------------------------------------------ *
 * Persisted + serialized shapes
 * ------------------------------------------------------------------ */

/** Persisted document (server-only). The raw key is never stored. */
interface SabcrmApiKeyDoc {
  _id: ObjectId;
  /** Tenant scope. Every key authenticates exactly one project. */
  projectId: string;
  /** SHA-256 hex of the raw key — the only thing matched on auth. */
  hash: string;
  /** Public, safe-to-display prefix (`sk_crm_` + first 6 random chars). */
  prefix: string;
  /** User-supplied label, e.g. "Zapier production". */
  label: string;
  /** Tenant user id that minted the key. */
  createdBy: string;
  createdAt: Date;
  /** Best-effort last-authentication timestamp. */
  lastUsedAt?: Date;
  /** Set when the key has been revoked; revoked keys never authenticate. */
  revokedAt?: Date;
  /** Tenant user id that revoked the key. */
  revokedBy?: string;
}

/**
 * Public-safe serialization of a key for listing in the UI / actions.
 * Never includes the `hash` or any way to reconstruct the raw key.
 */
export interface SabcrmApiKey {
  id: string;
  projectId: string;
  prefix: string;
  label: string;
  createdBy: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  revokedBy: string | null;
  /** Convenience flag derived from `revokedAt`. */
  revoked: boolean;
}

/**
 * Result of issuing a key. `rawKey` is the only time the secret is ever
 * exposed — surface it once to the caller and never log/persist it.
 */
export interface IssuedSabcrmApiKey {
  id: string;
  /** The full secret. Show once; it cannot be recovered later. */
  rawKey: string;
  /** Public prefix mirrored into the persisted doc. */
  prefix: string;
  key: SabcrmApiKey;
}

/**
 * Authenticated context produced by {@link verifyApiKey}. Intentionally minimal
 * — the public REST routes scope every query by `projectId`, exactly as the
 * in-app actions scope by `gate().ctx.projectId`.
 */
export interface SabcrmApiAuthContext {
  projectId: string;
  /** Hex id of the matched key — useful for rate-limit keying / audit. */
  keyId: string;
}

/* ------------------------------------------------------------------ *
 * Internals
 * ------------------------------------------------------------------ */

/** SHA-256 hex digest of the raw key. */
function hashKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

let indexesEnsured = false;

async function collection(): Promise<Collection<SabcrmApiKeyDoc>> {
  const { db } = await connectToDatabase();
  const col = db.collection<SabcrmApiKeyDoc>(SABCRM_API_KEYS_COLLECTION);

  if (!indexesEnsured) {
    await Promise.all([
      // Auth lookup — unique so a hash collision (or duplicate insert) is
      // impossible; leads the verify path.
      col.createIndex({ hash: 1 }, { unique: true, background: true }),
      // Tenant list, newest-first.
      col.createIndex(
        { projectId: 1, createdAt: -1 },
        { background: true },
      ),
    ]);
    indexesEnsured = true;
  }

  return col;
}

/** Map a persisted doc to its public-safe serialization. */
function toPublic(doc: SabcrmApiKeyDoc): SabcrmApiKey {
  return {
    id: doc._id.toHexString(),
    projectId: doc.projectId,
    prefix: doc.prefix,
    label: doc.label,
    createdBy: doc.createdBy,
    createdAt: doc.createdAt.toISOString(),
    lastUsedAt: doc.lastUsedAt ? doc.lastUsedAt.toISOString() : null,
    revokedAt: doc.revokedAt ? doc.revokedAt.toISOString() : null,
    revokedBy: doc.revokedBy ?? null,
    revoked: Boolean(doc.revokedAt),
  };
}

/**
 * Pull a bearer token out of an incoming request. Accepts the standard
 * `Authorization: Bearer …` header and an `X-Api-Key` convenience header
 * (case-insensitive), mirroring the platform `api-platform` extractor.
 */
function extractKey(req: Request): string | null {
  const authz =
    req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (authz) {
    const m = /^Bearer\s+(.+)$/i.exec(authz.trim());
    if (m && m[1]) return m[1].trim();
  }
  const direct = req.headers.get("x-api-key") ?? req.headers.get("X-Api-Key");
  if (direct && direct.trim()) return direct.trim();
  return null;
}

/* ------------------------------------------------------------------ *
 * Public API
 * ------------------------------------------------------------------ */

/**
 * Mint a fresh SabCRM API key for `projectId`.
 *
 * Returns the raw secret exactly once — it is never persisted in clear text
 * and cannot be recovered afterwards. RBAC/plan gating is the caller's
 * responsibility (the action layer's `gate('edit'|'admin')`).
 *
 * @throws never for normal input; Mongo errors propagate so the action layer's
 *         `fail()` helper can surface them.
 */
export async function issueApiKey(
  projectId: string,
  createdBy: string,
  label: string,
): Promise<IssuedSabcrmApiKey> {
  if (!projectId) throw new Error("projectId is required.");
  if (!createdBy) throw new Error("createdBy is required.");

  const random = randomBytes(KEY_ENTROPY_BYTES).toString("base64url");
  const rawKey = `${SABCRM_API_KEY_PREFIX}${random}`;
  const prefix = `${SABCRM_API_KEY_PREFIX}${random.slice(0, 6)}`;
  const hash = hashKey(rawKey);

  const doc: SabcrmApiKeyDoc = {
    _id: new ObjectId(),
    projectId,
    hash,
    prefix,
    label: label.trim() || "Untitled key",
    createdBy,
    createdAt: new Date(),
  };

  const col = await collection();
  await col.insertOne(doc);

  return {
    id: doc._id.toHexString(),
    rawKey,
    prefix,
    key: toPublic(doc),
  };
}

/**
 * List a project's keys (public-safe — no hashes, no raw secrets), newest
 * first. By default revoked keys are excluded; pass `includeRevoked` to show
 * the full history in an admin/audit view.
 */
export async function listApiKeys(
  projectId: string,
  options: { includeRevoked?: boolean } = {},
): Promise<SabcrmApiKey[]> {
  if (!projectId) return [];

  const col = await collection();
  const filter: Record<string, unknown> = { projectId };
  if (!options.includeRevoked) filter.revokedAt = { $exists: false };

  const docs = await col.find(filter).sort({ createdAt: -1 }).toArray();
  return docs.map(toPublic);
}

/**
 * Soft-revoke a single key. Tenant-scoped: only a key belonging to
 * `projectId` can be revoked, so one project can never revoke another's key.
 * Idempotent — re-revoking an already-revoked key is a no-op that returns
 * `false` (nothing modified).
 *
 * @returns true when a live key was revoked by this call.
 */
export async function revokeApiKey(
  projectId: string,
  keyId: string,
  revokedBy: string,
): Promise<boolean> {
  if (!projectId || !keyId || !ObjectId.isValid(keyId)) return false;

  const col = await collection();
  const res = await col.updateOne(
    { _id: new ObjectId(keyId), projectId, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date(), revokedBy } },
  );
  return res.modifiedCount === 1;
}

/**
 * Resolve a raw key string to its owning project, or `null` when the key is
 * unknown, malformed, or revoked. Bumps `lastUsedAt` best-effort.
 *
 * Prefer {@link verifyApiKey} from a route — this lower-level helper exists for
 * callers that already hold the raw secret (e.g. tests or non-Request
 * transports).
 */
export async function resolveApiKey(
  rawKey: string,
): Promise<SabcrmApiAuthContext | null> {
  if (!rawKey || !rawKey.startsWith(SABCRM_API_KEY_PREFIX)) return null;

  try {
    const col = await collection();
    const doc = await col.findOne({
      hash: hashKey(rawKey),
      revokedAt: { $exists: false },
    });
    if (!doc) return null;

    // Best-effort last-used bump — never block the request on it.
    void col
      .updateOne({ _id: doc._id }, { $set: { lastUsedAt: new Date() } })
      .catch(() => undefined);

    return { projectId: doc.projectId, keyId: doc._id.toHexString() };
  } catch (err) {
    console.error("[sabcrm] resolveApiKey failed:", err);
    return null;
  }
}

/**
 * Verify an inbound public-REST request's API key.
 *
 * Extracts the bearer / `X-Api-Key` token, matches its SHA-256 hash against a
 * live (non-revoked) `sabcrm_api_keys` row, and returns the owning
 * `{ projectId, keyId }`. Returns `null` for any failure — callers MUST treat
 * that as `401 Unauthorized`:
 *
 *   const auth = await verifyApiKey(req);
 *   if (!auth) return new Response('Unauthorized', { status: 401 });
 *   // every subsequent query is scoped to auth.projectId
 *
 * Never throws — DB/parse failures resolve to `null` so a public route can
 * fail closed.
 */
export async function verifyApiKey(
  req: Request,
): Promise<SabcrmApiAuthContext | null> {
  const plain = extractKey(req);
  if (!plain) return null;
  return resolveApiKey(plain);
}
