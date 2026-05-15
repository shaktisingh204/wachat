/**
 * API-key persistence helpers for `sabwa_api_keys`.
 *
 * Security model: tokens are generated server-side, returned to the caller
 * exactly once (`POST /v1/api-keys`), and only the SHA-256 hash is persisted.
 * Listing exposes only the public prefix so the UI can show a recognisable
 * fragment ("sabwa_xxxx…") without ever leaking the full token.
 *
 * Token format: `sabwa_<32-byte-base64url>`. Total length ≈ 49 chars.
 */

import { createHash, randomBytes } from 'node:crypto';
import { Collection, ObjectId, type Db } from 'mongodb';
import type { AppState } from '../state.js';

export interface ApiKeyDoc {
  _id: ObjectId;
  projectId: ObjectId;
  name: string;
  /** SHA-256 hex of the full token. */
  keyHash: string;
  /** Public prefix shown in the UI — first ~10 chars of the token. */
  keyPreview: string;
  scopes: string[];
  lastUsedAt?: Date;
  revokedAt?: Date;
  createdBy?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiKeyWire {
  id: string;
  projectId: string;
  name: string;
  /** Never the full token. */
  tokenPrefix: string;
  scopes: string[];
  lastUsedAt?: string;
  revokedAt?: string;
  createdAt: string;
  updatedAt: string;
}

const COLL = 'sabwa_api_keys';
const TOKEN_PREFIX = 'sabwa_';
const TOKEN_BYTES = 32;

function coll(db: Db): Collection<ApiKeyDoc> {
  return db.collection<ApiKeyDoc>(COLL);
}

function toWire(d: ApiKeyDoc): ApiKeyWire {
  const out: ApiKeyWire = {
    id: d._id.toHexString(),
    projectId: d.projectId.toHexString(),
    name: d.name,
    tokenPrefix: d.keyPreview,
    scopes: d.scopes ?? [],
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  };
  if (d.lastUsedAt) out.lastUsedAt = d.lastUsedAt.toISOString();
  if (d.revokedAt) out.revokedAt = d.revokedAt.toISOString();
  return out;
}

function generateToken(): { token: string; hash: string; preview: string } {
  const raw = randomBytes(TOKEN_BYTES).toString('base64url');
  const token = `${TOKEN_PREFIX}${raw}`;
  const hash = createHash('sha256').update(token).digest('hex');
  const preview = `${token.slice(0, 10)}…`;
  return { token, hash, preview };
}

export async function listApiKeys(
  state: AppState,
  projectId: string,
): Promise<ApiKeyWire[]> {
  if (!ObjectId.isValid(projectId)) return [];
  const docs = await coll(state.db)
    .find({ projectId: new ObjectId(projectId) })
    .sort({ createdAt: -1 })
    .toArray();
  return docs.map(toWire);
}

export interface CreateApiKeyInput {
  projectId: string;
  name: string;
  scopes: string[];
  createdBy?: string;
}

export interface CreatedApiKey {
  apiKey: ApiKeyWire;
  /** Full plaintext token — shown to the user once and never again. */
  token: string;
}

export async function createApiKey(
  state: AppState,
  input: CreateApiKeyInput,
): Promise<CreatedApiKey | null> {
  if (!ObjectId.isValid(input.projectId)) return null;
  const { token, hash, preview } = generateToken();
  const now = new Date();
  const doc: ApiKeyDoc = {
    _id: new ObjectId(),
    projectId: new ObjectId(input.projectId),
    name: input.name,
    keyHash: hash,
    keyPreview: preview,
    scopes: input.scopes,
    createdAt: now,
    updatedAt: now,
  };
  if (input.createdBy && ObjectId.isValid(input.createdBy)) {
    doc.createdBy = new ObjectId(input.createdBy);
  }
  await coll(state.db).insertOne(doc);
  return { apiKey: toWire(doc), token };
}

export async function deleteApiKey(state: AppState, id: string): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false;
  const r = await coll(state.db).deleteOne({ _id: new ObjectId(id) });
  return r.deletedCount === 1;
}

export async function findApiKey(
  state: AppState,
  id: string,
): Promise<ApiKeyDoc | null> {
  if (!ObjectId.isValid(id)) return null;
  return coll(state.db).findOne({ _id: new ObjectId(id) });
}

export const __forTest = { COLL, generateToken, toWire };
