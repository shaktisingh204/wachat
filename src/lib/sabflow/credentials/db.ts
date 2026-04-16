/**
 * SabFlow — Credentials DB helpers
 *
 * Stores credentials in the `sabflow_credentials` collection.  Raw `data`
 * values are encrypted at rest; callers always receive decrypted values.
 *
 * API routes MUST mask `data` before returning to the client.
 */

import 'server-only';

import { ObjectId, type Collection } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import type { Credential, CredentialType } from './types';
import { decryptRecord, encryptRecord } from './encryption';

/* ── Raw document shape (Mongo side) ────────────────────────────────────── */

interface CredentialDoc {
  _id: ObjectId;
  workspaceId: string;
  type: CredentialType;
  name: string;
  /** Encrypted key/value map */
  data: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

/* ── Collection accessor ────────────────────────────────────────────────── */

async function getCollection(): Promise<Collection<CredentialDoc>> {
  const { db } = await connectToDatabase();
  const col = db.collection<CredentialDoc>('sabflow_credentials');
  await col.createIndex({ workspaceId: 1, type: 1 }, { background: true });
  await col.createIndex({ workspaceId: 1, updatedAt: -1 }, { background: true });
  return col;
}

/* ── Shape mapping ──────────────────────────────────────────────────────── */

function docToCredential(doc: CredentialDoc): Credential {
  return {
    id: doc._id.toHexString(),
    workspaceId: doc.workspaceId,
    type: doc.type,
    name: doc.name,
    data: decryptRecord(doc.data ?? {}),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/* ── Public API ─────────────────────────────────────────────────────────── */

/**
 * Insert a new credential.  Returns the generated id (hex string).
 * `data` is encrypted before being written.
 */
export async function createCredential(
  cred: Omit<Credential, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  if (!cred.workspaceId) throw new Error('createCredential: workspaceId is required');
  if (!cred.type) throw new Error('createCredential: type is required');
  if (!cred.name?.trim()) throw new Error('createCredential: name is required');

  const col = await getCollection();
  const now = new Date();
  const _id = new ObjectId();

  const doc: CredentialDoc = {
    _id,
    workspaceId: cred.workspaceId,
    type: cred.type,
    name: cred.name.trim(),
    data: encryptRecord(cred.data ?? {}),
    createdAt: now,
    updatedAt: now,
  };

  await col.insertOne(doc);
  return _id.toHexString();
}

/**
 * List all credentials for a workspace, newest first.  Optionally filter by
 * provider type. Decrypted `data` is returned — mask it before sending to
 * the client.
 */
export async function getCredentials(
  workspaceId: string,
  type?: CredentialType,
): Promise<Credential[]> {
  if (!workspaceId) return [];

  const col = await getCollection();
  const filter: { workspaceId: string; type?: CredentialType } = { workspaceId };
  if (type) filter.type = type;

  const docs = await col.find(filter).sort({ updatedAt: -1 }).toArray();
  return docs.map(docToCredential);
}

/**
 * Fetch a single credential by its id (hex string).  Returns `null` when the
 * id is invalid or the document does not exist.
 */
export async function getCredentialById(id: string): Promise<Credential | null> {
  if (!id || !ObjectId.isValid(id)) return null;

  const col = await getCollection();
  const doc = await col.findOne({ _id: new ObjectId(id) });
  return doc ? docToCredential(doc) : null;
}

/**
 * Patch one or more fields of an existing credential.  `id`, `workspaceId`,
 * `createdAt` and `type` are ignored.  When `data` is provided it fully
 * replaces the previous map (values are re-encrypted).
 */
export async function updateCredential(
  id: string,
  updates: Partial<Credential>,
): Promise<void> {
  if (!ObjectId.isValid(id)) return;

  const col = await getCollection();
  const patch: Partial<CredentialDoc> = { updatedAt: new Date() };

  if (typeof updates.name === 'string') {
    const trimmed = updates.name.trim();
    if (trimmed) patch.name = trimmed;
  }
  if (updates.data && typeof updates.data === 'object') {
    patch.data = encryptRecord(updates.data);
  }

  await col.updateOne({ _id: new ObjectId(id) }, { $set: patch });
}

/**
 * Permanently delete a credential.  No-ops on an invalid id.
 */
export async function deleteCredential(id: string): Promise<void> {
  if (!ObjectId.isValid(id)) return;
  const col = await getCollection();
  await col.deleteOne({ _id: new ObjectId(id) });
}
