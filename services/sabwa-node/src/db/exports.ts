/**
 * `sabwa_exports` repository.
 *
 * One row per export job. The export worker picks up `status: 'queued'` rows,
 * streams matching messages out of `sabwa_messages`, serialises them in the
 * requested format, and parks the artifact on disk (or R2 in a future agent
 * once SabFiles plumbing reaches the engine). The wire shape mirrors
 * `SabwaExportRow` in `src/app/actions/sabwa.actions.ts`.
 */

import { type Db, type Collection } from 'mongodb';

export const COLLECTION = 'sabwa_exports';

export type ExportFormat = 'json' | 'csv' | 'txt' | 'pdf';
export type ExportStatus =
  | 'queued'
  | 'running'
  | 'ready'
  | 'failed'
  | 'expired';

export interface ExportScope {
  /**
   * 'all'        — every message in the session (bounded by session retention)
   * 'chats'      — only the listed jids
   * 'date_range' — every message within [from, to]
   */
  kind: 'all' | 'chats' | 'date_range';
  jids?: string[];
  from?: Date;
  to?: Date;
}

export interface ExportDoc {
  _id: string;
  projectId?: string;
  sessionId: string;
  format: ExportFormat;
  status: ExportStatus;
  scope: ExportScope;
  includeMedia: boolean;
  sizeBytes?: number;
  downloadUrl?: string;
  expiresAt?: Date;
  error?: string;
  startedAt?: Date;
  finishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExportWire {
  id: string;
  format: ExportFormat;
  status: ExportStatus;
  sizeBytes?: number;
  downloadUrl?: string;
  expiresAt?: Date;
  scope: ExportScope;
  includeMedia: boolean;
  createdAt: Date;
}

function collection(db: Db): Collection<ExportDoc> {
  return db.collection<ExportDoc>(COLLECTION);
}

export function toWire(doc: ExportDoc): ExportWire {
  return {
    id: doc._id,
    format: doc.format,
    status: doc.status,
    sizeBytes: doc.sizeBytes,
    downloadUrl: doc.downloadUrl,
    expiresAt: doc.expiresAt,
    scope: doc.scope,
    includeMedia: doc.includeMedia,
    createdAt: doc.createdAt,
  };
}

export async function listBySession(db: Db, sessionId: string): Promise<ExportDoc[]> {
  return collection(db).find({ sessionId }).sort({ createdAt: -1 }).limit(100).toArray();
}

export async function findById(db: Db, id: string): Promise<ExportDoc | null> {
  return collection(db).findOne({ _id: id });
}

export async function createExport(
  db: Db,
  input: {
    sessionId: string;
    projectId?: string;
    format: ExportFormat;
    scope: ExportScope;
    includeMedia: boolean;
  },
): Promise<string> {
  const id = `exp_${globalThis.crypto.randomUUID()}`;
  const now = new Date();
  await collection(db).insertOne({
    _id: id,
    projectId: input.projectId,
    sessionId: input.sessionId,
    format: input.format,
    status: 'queued',
    scope: input.scope,
    includeMedia: input.includeMedia,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function setStatus(
  db: Db,
  id: string,
  status: ExportStatus,
  extra?: Partial<ExportDoc>,
): Promise<void> {
  const now = new Date();
  const set: Partial<ExportDoc> & { status: ExportStatus; updatedAt: Date } = {
    status,
    updatedAt: now,
    ...extra,
  };
  if (status === 'running' && !extra?.startedAt) set.startedAt = now;
  if (status === 'ready' || status === 'failed' || status === 'expired') {
    set.finishedAt = now;
  }
  await collection(db).updateOne({ _id: id }, { $set: set });
}

export async function takeNextQueued(db: Db): Promise<ExportDoc | null> {
  // Atomic claim — flips queued → running and returns the row.
  const res = await collection(db).findOneAndUpdate(
    { status: 'queued' },
    { $set: { status: 'running', startedAt: new Date(), updatedAt: new Date() } },
    { returnDocument: 'after', sort: { createdAt: 1 } },
  );
  return res ?? null;
}
