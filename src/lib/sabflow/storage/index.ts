/**
 * SabFlow — Storage facade
 *
 * Resolves the active {@link StorageAdapter} based on the
 * `SABFLOW_STORAGE_PROVIDER` env var and exposes small helpers for
 * reading/writing file metadata from MongoDB.
 *
 * Metadata lives in the `sabflow_files` collection with these indexes:
 *   { flowId: 1, uploadedAt: -1 }
 *   { sessionId: 1 }
 *   { workspaceId: 1 }
 */

import { ObjectId } from 'mongodb';
import type { Collection } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import type { StorageAdapter } from './adapter';
import { LocalStorageAdapter } from './localAdapter';
import { S3StorageAdapter } from './s3Adapter';
import type { StoredFile, StorageProvider } from './types';

/* ── Adapter factory ────────────────────────────────────────── */

let cachedAdapter: StorageAdapter | null = null;
let cachedProvider: StorageProvider | null = null;

function resolveProvider(): StorageProvider {
  const raw = (process.env.SABFLOW_STORAGE_PROVIDER ?? 'local').toLowerCase();
  if (raw === 's3' || raw === 'blob' || raw === 'local') return raw;
  return 'local';
}

/** Returns the currently active storage adapter (singleton). */
export function getStorageAdapter(): StorageAdapter {
  const provider = resolveProvider();
  if (cachedAdapter && cachedProvider === provider) return cachedAdapter;

  switch (provider) {
    case 's3':
      cachedAdapter = new S3StorageAdapter();
      break;
    case 'blob':
      // Vercel Blob is not yet implemented — fall through to local for now
      // so the system keeps working.  Dedicated adapter can be added later.
      cachedAdapter = new LocalStorageAdapter();
      break;
    case 'local':
    default:
      cachedAdapter = new LocalStorageAdapter();
      break;
  }
  cachedProvider = provider;
  return cachedAdapter;
}

/** Exposes the active provider name (useful for metadata writes). */
export function getActiveProvider(): StorageProvider {
  return resolveProvider();
}

/* ── Metadata persistence ──────────────────────────────────── */

interface StoredFileDoc {
  _id: ObjectId;
  flowId?: string;
  sessionId?: string;
  workspaceId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  url: string;
  provider: StorageProvider;
  uploadedAt: Date;
  uploadedBy?: string;
  storageKey?: string;
}

async function getCollection(): Promise<Collection<StoredFileDoc>> {
  const { db } = await connectToDatabase();
  const col = db.collection<StoredFileDoc>('sabflow_files');
  await Promise.all([
    col.createIndex({ flowId: 1, uploadedAt: -1 }, { background: true }),
    col.createIndex({ sessionId: 1 }, { background: true }),
    col.createIndex({ workspaceId: 1 }, { background: true }),
  ]);
  return col;
}

function fromDoc(doc: StoredFileDoc): StoredFile {
  return {
    id: doc._id.toHexString(),
    flowId: doc.flowId,
    sessionId: doc.sessionId,
    workspaceId: doc.workspaceId,
    filename: doc.filename,
    contentType: doc.contentType,
    sizeBytes: doc.sizeBytes,
    url: doc.url,
    provider: doc.provider,
    uploadedAt: doc.uploadedAt,
    uploadedBy: doc.uploadedBy,
    storageKey: doc.storageKey,
  };
}

/** Inserts a new metadata row. Returns the new id as a hex string. */
export async function saveFileMetadata(
  file: Omit<StoredFile, 'id' | 'uploadedAt'>,
): Promise<string> {
  const col = await getCollection();
  const _id = new ObjectId();
  await col.insertOne({
    _id,
    flowId: file.flowId,
    sessionId: file.sessionId,
    workspaceId: file.workspaceId,
    filename: file.filename,
    contentType: file.contentType,
    sizeBytes: file.sizeBytes,
    url: file.url,
    provider: file.provider,
    uploadedAt: new Date(),
    uploadedBy: file.uploadedBy,
    storageKey: file.storageKey,
  });
  return _id.toHexString();
}

/** Returns all files associated with a flow, newest first. */
export async function getFilesByFlow(flowId: string): Promise<StoredFile[]> {
  const col = await getCollection();
  const docs = await col.find({ flowId }).sort({ uploadedAt: -1 }).toArray();
  return docs.map(fromDoc);
}

/** Returns a single file by id, or null if not found. */
export async function getFileById(id: string): Promise<StoredFile | null> {
  if (!ObjectId.isValid(id)) return null;
  const col = await getCollection();
  const doc = await col.findOne({ _id: new ObjectId(id) });
  return doc ? fromDoc(doc) : null;
}

/**
 * Deletes a file from both the storage backend and the metadata row.
 * Silently noop when the id is invalid / not found.
 */
export async function deleteFile(id: string): Promise<void> {
  if (!ObjectId.isValid(id)) return;
  const col = await getCollection();
  const doc = await col.findOne({ _id: new ObjectId(id) });
  if (!doc) return;

  // Best-effort storage delete: don't let a missing object keep the metadata
  // row alive forever.  Errors are logged and swallowed.
  if (doc.storageKey) {
    try {
      const adapter = getStorageAdapter();
      await adapter.delete(doc.storageKey);
    } catch (err) {
      console.error('[sabflow/storage] adapter delete failed', {
        id,
        err: err instanceof Error ? err.message : err,
      });
    }
  }

  await col.deleteOne({ _id: new ObjectId(id) });
}

export type { StoredFile, StorageProvider } from './types';
export type { StorageAdapter } from './adapter';
