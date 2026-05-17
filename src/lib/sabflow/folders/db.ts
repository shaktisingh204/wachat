/**
 * SabFlow folder records.
 *
 * Step 6 added folders as derived strings on `SabFlowDoc.folderId`.  This
 * promotes them to proper documents so users can create empty folders,
 * rename them without touching every flow, and pick a colour swatch.
 *
 * Collection: `sabflow_folders`  (matches the `SabFlowFolder` type)
 *
 * When a folder is deleted, every flow that was assigned to it gets its
 * `folderId` cleared in the same write — flows aren't deleted with the
 * folder.
 */

import { Collection, ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import type { SabFlowFolder } from '@/lib/sabflow/types';

interface FolderDoc extends Omit<SabFlowFolder, '_id'> {
  _id: ObjectId;
}

const NAME_MAX = 60;

async function getFoldersCollection(): Promise<Collection<FolderDoc>> {
  const { db } = await connectToDatabase();
  const col = db.collection<FolderDoc>('sabflow_folders');
  await col.createIndex({ userId: 1, name: 1 }, { unique: true, background: true });
  return col;
}

function mapDoc(doc: FolderDoc): SabFlowFolder & { _id: string } {
  return {
    _id: doc._id.toHexString() as unknown as ObjectId,
    userId: doc.userId,
    name: doc.name,
    color: doc.color,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  } as unknown as SabFlowFolder & { _id: string };
}

export async function listFolders(
  userId: string,
): Promise<(SabFlowFolder & { _id: string })[]> {
  const col = await getFoldersCollection();
  const docs = await col.find({ userId }).sort({ name: 1 }).toArray();
  return docs.map(mapDoc);
}

export async function createFolder(
  userId: string,
  name: string,
  color?: string,
): Promise<SabFlowFolder & { _id: string }> {
  const cleaned = name.trim();
  if (!cleaned) throw new Error('Folder name is required');
  if (cleaned.length > NAME_MAX) {
    throw new Error(`Folder name too long (max ${NAME_MAX} chars)`);
  }

  const col = await getFoldersCollection();
  const now = new Date();
  const oid = new ObjectId();
  const doc: FolderDoc = {
    _id: oid,
    userId,
    name: cleaned,
    color: color?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  };
  try {
    await col.insertOne(doc);
  } catch (err) {
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code?: number }).code === 11000
    ) {
      throw new Error(`A folder named "${cleaned}" already exists`);
    }
    throw err;
  }
  return mapDoc(doc);
}

export async function renameFolder(
  userId: string,
  folderId: string,
  newName: string,
  newColor?: string,
): Promise<boolean> {
  if (!ObjectId.isValid(folderId)) return false;
  const cleaned = newName.trim();
  if (!cleaned) throw new Error('Folder name is required');
  if (cleaned.length > NAME_MAX) {
    throw new Error(`Folder name too long (max ${NAME_MAX} chars)`);
  }

  const col = await getFoldersCollection();

  // Read current name so we can also cascade the rename onto every flow's
  // `folderId` field (which currently stores the folder NAME, see Step 6).
  const existing = await col.findOne({
    _id: new ObjectId(folderId),
    userId,
  });
  if (!existing) return false;

  const { db } = await connectToDatabase();
  const flowsCol = db.collection('sabflows');

  const ops: Array<Promise<unknown>> = [
    col.updateOne(
      { _id: new ObjectId(folderId), userId },
      { $set: { name: cleaned, color: newColor?.trim() || undefined, updatedAt: new Date() } },
    ),
  ];
  if (existing.name !== cleaned) {
    ops.push(
      flowsCol.updateMany(
        { userId, folderId: existing.name },
        { $set: { folderId: cleaned, updatedAt: new Date() } },
      ),
    );
  }
  await Promise.all(ops);
  return true;
}

export async function deleteFolder(
  userId: string,
  folderId: string,
): Promise<boolean> {
  if (!ObjectId.isValid(folderId)) return false;
  const col = await getFoldersCollection();
  const existing = await col.findOne({
    _id: new ObjectId(folderId),
    userId,
  });
  if (!existing) return false;

  const { db } = await connectToDatabase();
  const flowsCol = db.collection('sabflows');

  await Promise.all([
    col.deleteOne({ _id: new ObjectId(folderId), userId }),
    // Clear folderId on every flow that referenced this folder so they
    // fall back to the workspace root.
    flowsCol.updateMany(
      { userId, folderId: existing.name },
      { $unset: { folderId: '' }, $set: { updatedAt: new Date() } },
    ),
  ]);
  return true;
}
