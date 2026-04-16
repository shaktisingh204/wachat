/**
 * SabFlow — Custom domains DB helpers
 *
 * Collection: `sabflow_custom_domains`
 *
 * Domains are looked up by:
 *  - id              (unique, cuid2)
 *  - domain          (unique, used by the proxy for host-based rewriting)
 *  - workspaceId     (list view in the dashboard)
 */

import 'server-only';

import { createId } from '@paralleldrive/cuid2';
import type { Collection } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import type {
  CustomDomain,
  DomainStatus,
  SslStatus,
} from './types';
import { normaliseDomain } from './types';

/* ── Raw Mongo document shape ───────────────────────────────────────────── */

interface CustomDomainDoc {
  _id: string;
  workspaceId: string;
  flowId?: string;
  domain: string;
  status: DomainStatus;
  verificationToken: string;
  sslStatus: SslStatus;
  createdAt: Date;
  lastCheckedAt?: Date;
}

/* ── Collection accessor ────────────────────────────────────────────────── */

async function getCollection(): Promise<Collection<CustomDomainDoc>> {
  const { db } = await connectToDatabase();
  const col = db.collection<CustomDomainDoc>('sabflow_custom_domains');
  await col.createIndex({ domain: 1 }, { unique: true, background: true });
  await col.createIndex({ workspaceId: 1, createdAt: -1 }, { background: true });
  return col;
}

/* ── Shape mapping ──────────────────────────────────────────────────────── */

function docToDomain(doc: CustomDomainDoc): CustomDomain {
  const out: CustomDomain = {
    id: doc._id,
    workspaceId: doc.workspaceId,
    domain: doc.domain,
    status: doc.status,
    verificationToken: doc.verificationToken,
    sslStatus: doc.sslStatus,
    createdAt: doc.createdAt,
  };
  if (doc.flowId) out.flowId = doc.flowId;
  if (doc.lastCheckedAt) out.lastCheckedAt = doc.lastCheckedAt;
  return out;
}

/* ── Public API ─────────────────────────────────────────────────────────── */

export interface CreateDomainInput {
  workspaceId: string;
  domain: string;
  flowId?: string;
}

/**
 * Create a new pending custom domain record.  The returned domain carries a
 * freshly generated `verificationToken` that the user must add as a TXT
 * record on `_sabflow.{domain}`.
 */
export async function createDomain(
  input: CreateDomainInput,
): Promise<CustomDomain> {
  if (!input.workspaceId) {
    throw new Error('createDomain: workspaceId is required');
  }
  const domain = normaliseDomain(input.domain);
  if (!domain) {
    throw new Error('createDomain: invalid domain');
  }

  const col = await getCollection();
  const now = new Date();

  const doc: CustomDomainDoc = {
    _id: createId(),
    workspaceId: input.workspaceId,
    domain,
    status: 'pending',
    verificationToken: createId(),
    sslStatus: 'pending',
    createdAt: now,
  };
  if (input.flowId) doc.flowId = input.flowId;

  await col.insertOne(doc);
  return docToDomain(doc);
}

/** List every custom domain owned by the given workspace, newest first. */
export async function getDomainsByWorkspace(
  workspaceId: string,
): Promise<CustomDomain[]> {
  if (!workspaceId) return [];
  const col = await getCollection();
  const docs = await col
    .find({ workspaceId })
    .sort({ createdAt: -1 })
    .toArray();
  return docs.map(docToDomain);
}

/** Fetch a single domain by its stable cuid2 id. */
export async function getDomainById(id: string): Promise<CustomDomain | null> {
  if (!id) return null;
  const col = await getCollection();
  const doc = await col.findOne({ _id: id });
  return doc ? docToDomain(doc) : null;
}

/** Fetch a single domain by its hostname (used by the routing proxy). */
export async function getDomainByName(
  domain: string,
): Promise<CustomDomain | null> {
  const normalised = normaliseDomain(domain);
  if (!normalised) return null;
  const col = await getCollection();
  const doc = await col.findOne({ domain: normalised });
  return doc ? docToDomain(doc) : null;
}

/**
 * Patch one or more fields of an existing domain record.  Immutable fields
 * (`id`, `workspaceId`, `domain`, `verificationToken`, `createdAt`) are
 * silently ignored.
 */
export async function updateDomain(
  id: string,
  updates: Partial<CustomDomain>,
): Promise<void> {
  if (!id) return;
  const col = await getCollection();

  const patch: Partial<CustomDomainDoc> = {};
  if (updates.status) patch.status = updates.status;
  if (updates.sslStatus) patch.sslStatus = updates.sslStatus;
  if (updates.flowId !== undefined) {
    // Allow unsetting by passing empty string.
    if (updates.flowId) patch.flowId = updates.flowId;
  }
  if (updates.lastCheckedAt) patch.lastCheckedAt = updates.lastCheckedAt;

  if (Object.keys(patch).length === 0) return;
  await col.updateOne({ _id: id }, { $set: patch });
}

/** Permanently delete a domain record. */
export async function deleteDomain(id: string): Promise<void> {
  if (!id) return;
  const col = await getCollection();
  await col.deleteOne({ _id: id });
}
