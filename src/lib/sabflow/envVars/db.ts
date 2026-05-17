/**
 * SabFlow workspace-scoped environment variables.
 *
 * `$env.KEY` in expression tokens resolves against these — separate from
 * per-flow variables (which live on the flow doc).  Used for things you
 * want to share across flows but not hard-code in code: API keys for
 * third-party services, environment-conditional URLs, secret rotations.
 *
 * Collection: `sabflow_env_vars`
 *   { _id, userId, key, value, isSecret, updatedAt }
 *
 * Secrets aren't separately encrypted at rest yet — Mongo-level encryption
 * is the workspace's responsibility.  When `isSecret: true` the value is
 * never returned by `listEnvVars` (the engine still reads it via
 * `loadEnvVars`).
 */

import { Collection, ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';

export interface EnvVar {
  _id: string;
  userId: string;
  key: string;
  value: string;
  isSecret: boolean;
  updatedAt: Date;
}

/** UI-safe shape — secrets get their `value` blanked. */
export interface EnvVarPublic {
  _id: string;
  key: string;
  value: string | null;
  isSecret: boolean;
  updatedAt: Date;
}

interface EnvVarDoc {
  _id: ObjectId;
  userId: string;
  key: string;
  value: string;
  isSecret: boolean;
  updatedAt: Date;
}

const KEY_RE = /^[A-Z][A-Z0-9_]*$/;

async function getCollection(): Promise<Collection<EnvVarDoc>> {
  const { db } = await connectToDatabase();
  const col = db.collection<EnvVarDoc>('sabflow_env_vars');
  await col.createIndex({ userId: 1, key: 1 }, { unique: true, background: true });
  return col;
}

export function validateKey(key: string): string | null {
  if (!key) return 'Key is required';
  if (key.length > 64) return 'Key too long (max 64 chars)';
  if (!KEY_RE.test(key))
    return 'Key must be UPPER_SNAKE_CASE (letters, digits, underscores; starts with a letter)';
  return null;
}

export async function listEnvVars(userId: string): Promise<EnvVarPublic[]> {
  const col = await getCollection();
  const docs = await col.find({ userId }).sort({ key: 1 }).toArray();
  return docs.map((d) => ({
    _id: d._id.toHexString(),
    key: d.key,
    value: d.isSecret ? null : d.value,
    isSecret: d.isSecret,
    updatedAt: d.updatedAt,
  }));
}

/** Returns `{ KEY: 'value', … }` — used by the engine's `$env` proxy. */
export async function loadEnvVars(userId: string): Promise<Record<string, string>> {
  const col = await getCollection();
  const docs = await col.find({ userId }).toArray();
  const out: Record<string, string> = {};
  for (const d of docs) out[d.key] = d.value;
  return out;
}

export async function upsertEnvVar(
  userId: string,
  key: string,
  value: string,
  isSecret: boolean,
): Promise<EnvVarPublic> {
  const err = validateKey(key);
  if (err) throw new Error(err);

  const col = await getCollection();
  const now = new Date();
  await col.updateOne(
    { userId, key },
    {
      $set: { value, isSecret, updatedAt: now },
      $setOnInsert: { userId, key },
    },
    { upsert: true },
  );
  const doc = await col.findOne({ userId, key });
  if (!doc) throw new Error('Failed to persist env var');
  return {
    _id: doc._id.toHexString(),
    key: doc.key,
    value: doc.isSecret ? null : doc.value,
    isSecret: doc.isSecret,
    updatedAt: doc.updatedAt,
  };
}

export async function deleteEnvVar(userId: string, key: string): Promise<boolean> {
  const col = await getCollection();
  const res = await col.deleteOne({ userId, key });
  return res.deletedCount === 1;
}
