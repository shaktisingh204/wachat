'use server';

/**
 * SabSheet v2 — Live data connections, server actions.
 *
 * CRUD + "run now" over `sabsheet_connections`, every action session-scoped to
 * `ownerUserId` (reads and writes both filter on the caller). Secrets supplied
 * by the client are encrypted (AES-256-GCM) before storage and never returned.
 *
 * The actual polling + sheet write lives in the `'server-only'` run module
 * (`@/lib/sabsheet/connections/run.server`); these actions own persistence and
 * tenancy only.
 */

import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { encryptData } from '@/lib/sabflow/credentials/encryption';
import {
  SABSHEET_CONNECTIONS_COLLECTION,
  type SabsheetConnection,
  type CreateSabsheetConnectionInput,
  type UpdateSabsheetConnectionPatch,
} from '@/lib/sabsheet/connections/types';
import { runConnection, landRows } from '@/lib/sabsheet/connections/run.server';

async function requireUserId(): Promise<string> {
  const session = await getSession();
  const id = session?.user?._id;
  if (!id) throw new Error('SabSheet connections: not authenticated');
  return String(id);
}

function toIso(d: unknown): string | undefined {
  if (!d) return undefined;
  if (d instanceof Date) return d.toISOString();
  return String(d);
}

/** Map a Mongo doc to the wire shape — secrets/ciphertext are never included. */
function fromDoc(d: any): SabsheetConnection {
  return {
    _id: String(d._id),
    ownerUserId: String(d.ownerUserId),
    workbookId: String(d.workbookId),
    sheetId: d.sheetId ? String(d.sheetId) : undefined,
    type: d.type,
    config: d.config ?? {},
    target: d.target ?? { anchorRow: 1, anchorCol: 1 },
    schedule: d.schedule ?? { mode: 'manual' },
    credentialId: d.credentialId ? String(d.credentialId) : undefined,
    lastRunAt: toIso(d.lastRunAt),
    lastStatus: d.lastStatus ?? undefined,
    lastError: d.lastError ?? undefined,
    rowCount: typeof d.rowCount === 'number' ? d.rowCount : undefined,
    status: d.status ?? 'active',
    createdAt: toIso(d.createdAt),
    updatedAt: toIso(d.updatedAt),
  };
}

/** List the caller's connections for a workbook, newest first. */
export async function listConnections(workbookId: string): Promise<SabsheetConnection[]> {
  const userId = await requireUserId();
  let wbOid: ObjectId;
  try {
    wbOid = new ObjectId(workbookId);
  } catch {
    return [];
  }
  const { db } = await connectToDatabase();
  const rows = await db
    .collection(SABSHEET_CONNECTIONS_COLLECTION)
    .find({ workbookId: wbOid, ownerUserId: new ObjectId(userId) })
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray();
  return rows.map(fromDoc);
}

/** Create a connection. Encrypts `secret` (if any) into `credentialCipher`. */
export async function createConnection(
  input: CreateSabsheetConnectionInput,
): Promise<SabsheetConnection> {
  const userId = await requireUserId();
  if (!input.workbookId) throw new Error('workbookId is required');
  if (!input.type) throw new Error('type is required');

  const { db } = await connectToDatabase();
  const now = new Date();
  const doc: Record<string, unknown> = {
    ownerUserId: new ObjectId(userId),
    workbookId: new ObjectId(input.workbookId),
    sheetId: input.sheetId ? new ObjectId(input.sheetId) : undefined,
    type: input.type,
    config: input.config ?? {},
    target: {
      anchorRow: Math.max(1, Number(input.target?.anchorRow) || 1),
      anchorCol: Math.max(1, Number(input.target?.anchorCol) || 1),
    },
    schedule: {
      mode: input.schedule?.mode === 'interval' ? 'interval' : 'manual',
      everyMinutes:
        input.schedule?.mode === 'interval'
          ? Math.max(1, Number(input.schedule?.everyMinutes) || 60)
          : undefined,
    },
    credentialId: input.credentialId || undefined,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };
  if (input.secret && input.secret.length > 0) {
    doc.credentialCipher = encryptData(input.secret);
  }

  const res = await db.collection(SABSHEET_CONNECTIONS_COLLECTION).insertOne(doc);
  const fresh = await db
    .collection(SABSHEET_CONNECTIONS_COLLECTION)
    .findOne({ _id: res.insertedId });
  return fromDoc(fresh);
}

/** Patch a connection. Re-encrypts the secret when a new one is supplied. */
export async function updateConnection(
  id: string,
  patch: UpdateSabsheetConnectionPatch,
): Promise<SabsheetConnection | null> {
  const userId = await requireUserId();
  let oid: ObjectId;
  try {
    oid = new ObjectId(id);
  } catch {
    return null;
  }
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.sheetId !== undefined) {
    set.sheetId = patch.sheetId ? new ObjectId(patch.sheetId) : undefined;
  }
  if (patch.config !== undefined) set.config = patch.config;
  if (patch.target !== undefined) {
    set.target = {
      anchorRow: Math.max(1, Number(patch.target.anchorRow) || 1),
      anchorCol: Math.max(1, Number(patch.target.anchorCol) || 1),
    };
  }
  if (patch.schedule !== undefined) {
    set.schedule = {
      mode: patch.schedule.mode === 'interval' ? 'interval' : 'manual',
      everyMinutes:
        patch.schedule.mode === 'interval'
          ? Math.max(1, Number(patch.schedule.everyMinutes) || 60)
          : undefined,
    };
  }
  if (patch.status !== undefined) set.status = patch.status;
  if (patch.secret !== undefined) {
    set.credentialCipher = patch.secret ? encryptData(patch.secret) : undefined;
  }

  const { db } = await connectToDatabase();
  await db
    .collection(SABSHEET_CONNECTIONS_COLLECTION)
    .updateOne({ _id: oid, ownerUserId: new ObjectId(userId) }, { $set: set });
  const fresh = await db
    .collection(SABSHEET_CONNECTIONS_COLLECTION)
    .findOne({ _id: oid, ownerUserId: new ObjectId(userId) });
  return fresh ? fromDoc(fresh) : null;
}

/** Delete a connection owned by the caller. */
export async function deleteConnection(id: string): Promise<{ ok: boolean }> {
  const userId = await requireUserId();
  let oid: ObjectId;
  try {
    oid = new ObjectId(id);
  } catch {
    return { ok: false };
  }
  const { db } = await connectToDatabase();
  await db
    .collection(SABSHEET_CONNECTIONS_COLLECTION)
    .deleteOne({ _id: oid, ownerUserId: new ObjectId(userId) });
  return { ok: true };
}

/** Refresh a connection now: poll the source + land rows into the sheet. */
export async function runConnectionNow(
  id: string,
): Promise<{ ok: boolean; rowCount: number; error?: string }> {
  const userId = await requireUserId();
  let oid: ObjectId;
  try {
    oid = new ObjectId(id);
  } catch {
    return { ok: false, rowCount: 0, error: 'invalid id' };
  }
  const { db } = await connectToDatabase();
  const doc = await db
    .collection(SABSHEET_CONNECTIONS_COLLECTION)
    .findOne({ _id: oid, ownerUserId: new ObjectId(userId) });
  if (!doc) return { ok: false, rowCount: 0, error: 'not found' };

  const conn = fromDoc(doc);
  const { rows, error } = await runConnection(conn);
  const result = await landRows(conn, rows, error);
  return { ok: result.ok, rowCount: result.rowCount, error: result.error };
}
