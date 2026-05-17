/**
 * SabFlow audit log — Mongo-backed who-did-what trail.
 *
 * Collection: `sabflow_audit_log`
 *
 * Every meaningful mutation on a SabFlow resource (flow, credential,
 * api key, env var, folder) writes one row here so workspace owners can
 * answer "who changed this and when?".  Reads are filterable by actor,
 * action, or affected flow.
 *
 * Indexes:
 *   (userId,  createdAt:-1)  — workspace timeline reads
 *   (flowId,  createdAt:-1)  — per-flow timeline reads
 */

import { Collection, ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';

/* ──────────────────────────────────────────────────────────────────────────
   Types
   ────────────────────────────────────────────────────────────────────────── */

export type AuditAction =
  | 'flow.created'
  | 'flow.updated'
  | 'flow.deleted'
  | 'flow.published'
  | 'flow.archived'
  | 'credential.created'
  | 'credential.updated'
  | 'credential.deleted'
  | 'apiKey.created'
  | 'apiKey.revoked'
  | 'env.upserted'
  | 'env.deleted'
  | 'folder.created'
  | 'folder.renamed'
  | 'folder.deleted';

export interface AuditEntry {
  _id: string;
  userId: string;
  workspaceId?: string;
  flowId?: string;
  action: AuditAction | string;
  target?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

/** Raw Mongo shape — `_id` is an ObjectId on disk. */
interface AuditDoc extends Omit<AuditEntry, '_id'> {
  _id: ObjectId;
}

export interface ListAuditOptions {
  limit?: number;
  skip?: number;
  action?: string;
  flowId?: string;
}

/* ──────────────────────────────────────────────────────────────────────────
   Collection accessor
   ────────────────────────────────────────────────────────────────────────── */

export async function getAuditCollection(): Promise<Collection<AuditDoc>> {
  const { db } = await connectToDatabase();
  const col = db.collection<AuditDoc>('sabflow_audit_log');
  await Promise.all([
    col.createIndex({ userId: 1, createdAt: -1 }, { background: true }),
    col.createIndex({ flowId: 1, createdAt: -1 }, { background: true }),
  ]);
  return col;
}

/* ──────────────────────────────────────────────────────────────────────────
   Writers
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Append a single audit entry.  `_id` and `createdAt` are auto-filled
 * when omitted.  `workspaceId` defaults to `userId` for the
 * single-tenant case.
 */
export async function recordAudit(
  entry: Omit<AuditEntry, '_id' | 'createdAt'> & {
    _id?: string;
    createdAt?: Date;
  },
): Promise<AuditEntry> {
  if (!entry.userId) {
    throw new Error('recordAudit: userId is required');
  }
  if (!entry.action) {
    throw new Error('recordAudit: action is required');
  }

  const col = await getAuditCollection();
  const oid = entry._id && ObjectId.isValid(entry._id)
    ? new ObjectId(entry._id)
    : new ObjectId();
  const createdAt = entry.createdAt ?? new Date();

  const doc: AuditDoc = {
    _id: oid,
    userId: entry.userId,
    workspaceId: entry.workspaceId ?? entry.userId,
    flowId: entry.flowId,
    action: entry.action,
    target: entry.target,
    metadata: entry.metadata,
    createdAt,
    ipAddress: entry.ipAddress,
    userAgent: entry.userAgent,
  };

  await col.insertOne(doc);

  return {
    ...doc,
    _id: oid.toHexString(),
  };
}

/* ──────────────────────────────────────────────────────────────────────────
   Readers
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Read a paginated, optionally-filtered audit slice for a workspace.
 *
 * Returns `{ entries, total }` so the UI can render a "load more" /
 * page count alongside the rows.
 */
export async function listAudit(
  userId: string,
  opts: ListAuditOptions = {},
): Promise<{ entries: AuditEntry[]; total: number }> {
  if (!userId) {
    return { entries: [], total: 0 };
  }
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const skip = Math.max(opts.skip ?? 0, 0);

  const filter: Record<string, unknown> = { userId };
  if (opts.action) filter.action = opts.action;
  if (opts.flowId) filter.flowId = opts.flowId;

  const col = await getAuditCollection();
  const [docs, total] = await Promise.all([
    col.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
    col.countDocuments(filter),
  ]);

  const entries: AuditEntry[] = docs.map((d) => ({
    _id: d._id.toHexString(),
    userId: d.userId,
    workspaceId: d.workspaceId,
    flowId: d.flowId,
    action: d.action,
    target: d.target,
    metadata: d.metadata,
    createdAt: d.createdAt,
    ipAddress: d.ipAddress,
    userAgent: d.userAgent,
  }));

  return { entries, total };
}
