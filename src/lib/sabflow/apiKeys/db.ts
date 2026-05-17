/**
 * SabFlow API key store.
 *
 * Keys authenticate external automation (Zapier-style callers, CI scripts)
 * against the workspace's flows.  A key is a `sk_live_` prefix + 32 bytes of
 * random base64url — we never store the raw key, only its SHA-256 hash.
 *
 * Collection: `sabflow_api_keys`
 *   { _id, userId, hash, prefix, label, createdAt, lastUsedAt? }
 *
 * Hashing scheme: SHA-256 of the raw key string.  The hash is a hex digest
 * for human-readable Mongo inspection.  A leaked DB dump does not let an
 * attacker recover working keys (rainbow-table-resistant only when the key
 * material has enough entropy — 32 bytes is plenty).
 */

import { Collection, ObjectId } from 'mongodb';
import { createHash, randomBytes } from 'crypto';
import { connectToDatabase } from '@/lib/mongodb';

export interface ApiKey {
  _id: string;
  userId: string;
  /** SHA-256 hex of the raw key, used for `findOne` on auth. */
  hash: string;
  /** Public prefix (`sk_live_` + first 6 chars) — safe to expose in UI lists. */
  prefix: string;
  /** User-supplied label for the key. */
  label: string;
  createdAt: Date;
  lastUsedAt?: Date;
}

interface ApiKeyDoc {
  _id: ObjectId;
  userId: string;
  hash: string;
  prefix: string;
  label: string;
  createdAt: Date;
  lastUsedAt?: Date;
}

async function getCollection(): Promise<Collection<ApiKeyDoc>> {
  const { db } = await connectToDatabase();
  const col = db.collection<ApiKeyDoc>('sabflow_api_keys');
  await col.createIndex({ hash: 1 }, { unique: true, background: true });
  await col.createIndex({ userId: 1 }, { background: true });
  return col;
}

function hashKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex');
}

/** Mint a fresh API key.  Returns the raw key (show once, never persisted). */
export async function createApiKey(
  userId: string,
  label: string,
): Promise<{ id: string; rawKey: string; prefix: string }> {
  const random = randomBytes(24).toString('base64url');
  const rawKey = `sk_live_${random}`;
  const hash = hashKey(rawKey);
  const prefix = `sk_live_${random.slice(0, 6)}`;

  const col = await getCollection();
  const oid = new ObjectId();
  await col.insertOne({
    _id: oid,
    userId,
    hash,
    prefix,
    label: label.trim() || 'Untitled key',
    createdAt: new Date(),
  });

  return { id: oid.toHexString(), rawKey, prefix };
}

/** Resolve a raw key back to its owning userId, or null when invalid. */
export async function resolveApiKey(rawKey: string): Promise<string | null> {
  if (!rawKey || !rawKey.startsWith('sk_live_')) return null;
  const col = await getCollection();
  const doc = await col.findOne({ hash: hashKey(rawKey) });
  if (!doc) return null;
  // Best-effort lastUsedAt update — don't block on this.
  col
    .updateOne({ _id: doc._id }, { $set: { lastUsedAt: new Date() } })
    .catch(() => undefined);
  return doc.userId;
}

/** List the caller's keys with only public-safe fields. */
export async function listApiKeys(userId: string): Promise<ApiKey[]> {
  const col = await getCollection();
  const docs = await col
    .find({ userId })
    .sort({ createdAt: -1 })
    .toArray();
  return docs.map((d) => ({
    _id: d._id.toHexString(),
    userId: d.userId,
    hash: '',           // never expose the hash
    prefix: d.prefix,
    label: d.label,
    createdAt: d.createdAt,
    lastUsedAt: d.lastUsedAt,
  }));
}

/** Revoke a single key by id (only the owner can revoke). */
export async function revokeApiKey(
  userId: string,
  keyId: string,
): Promise<boolean> {
  if (!ObjectId.isValid(keyId)) return false;
  const col = await getCollection();
  const res = await col.deleteOne({ _id: new ObjectId(keyId), userId });
  return res.deletedCount === 1;
}
