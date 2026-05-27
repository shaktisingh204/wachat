'use server';

import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';

import { connectToDatabase } from '@/lib/mongodb';
import {
  hrDelete,
  hrGetById,
  hrList,
  hrSave,
  requireSession,
  serialize,
  formToObject,
} from '@/lib/hr-crud';
import type {
  WsFileStorage,
  WsFileFolder,
  WsFileAttachableType,
  WsFolderTreeNode,
} from '@/lib/worksuite/file-types';

/**
 * Worksuite File Storage actions — ported from PHP FileStorage +
 * polymorphic file tables.
 *
 * NOTE: Actual binary upload is NOT implemented here — SabNode does
 * not ship a blob backend in this module. `uploadFile` persists a
 * metadata record assuming the caller has already hosted the file
 * (e.g. in the existing Firebase bucket) and has a direct URL.
 *
 * Collections: `crm_file_storage`, `crm_file_folders`.
 */

const COL_FILES = 'crm_file_storage';
const COL_FOLDERS = 'crm_file_folders';
const ROUTE_BASE = '/dashboard/crm/files';

/* ────────────────────────────────────────────────────────────────
 *  Folder CRUD
 * ─────────────────────────────────────────────────────────────── */

export async function getFileFolders() {
  return hrList<WsFileFolder>(COL_FOLDERS, { sortBy: { name: 1 } });
}

export async function getFileFolderById(id: string) {
  return hrGetById<WsFileFolder>(COL_FOLDERS, id);
}

export async function saveFileFolder(_prev: unknown, formData: FormData) {
  try {
    const data = formToObject(formData);
    const res = await hrSave(COL_FOLDERS, data);
    if (res.error) return { error: res.error };
    revalidatePath(`${ROUTE_BASE}/folders`);
    revalidatePath(ROUTE_BASE);
    return { message: 'Folder saved.', id: res.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to save folder';
    return { error: msg };
  }
}

export async function deleteFileFolder(id: string) {
  const res = await hrDelete(COL_FOLDERS, id);
  // Detach any files that referenced the removed folder.
  const user = await requireSession();
  if (user) {
    const { db } = await connectToDatabase();
    await db
      .collection(COL_FILES)
      .updateMany(
        { userId: new ObjectId(user._id), folder_id: id },
        { $unset: { folder_id: '' } },
      );
    // Re-parent any child folders to root.
    await db
      .collection(COL_FOLDERS)
      .updateMany(
        { userId: new ObjectId(user._id), parent_folder_id: id },
        { $unset: { parent_folder_id: '' } },
      );
  }
  revalidatePath(`${ROUTE_BASE}/folders`);
  revalidatePath(ROUTE_BASE);
  return res;
}

/* ────────────────────────────────────────────────────────────────
 *  File CRUD
 * ─────────────────────────────────────────────────────────────── */

export async function getFiles(folderId?: string | null) {
  const user = await requireSession();
  if (!user) return [];
  const { db } = await connectToDatabase();
  const filter: Record<string, unknown> = {
    userId: new ObjectId(user._id),
  };
  if (folderId === null) {
    filter.folder_id = { $in: [null, undefined, ''] };
  } else if (typeof folderId === 'string' && folderId.length > 0) {
    filter.folder_id = folderId;
  }
  const docs = await db
    .collection(COL_FILES)
    .find(filter)
    .sort({ createdAt: -1 })
    .toArray();
  return serialize(docs) as WsFileStorage[];
}

export async function getFileById(id: string) {
  return hrGetById<WsFileStorage>(COL_FILES, id);
}

export async function saveFile(_prev: unknown, formData: FormData) {
  try {
    const data = formToObject(formData, ['size_bytes']);
    if (data.is_public !== undefined) {
      const v = data.is_public;
      data.is_public =
        v === true || v === 'true' || v === 'on' || v === '1' || v === 'yes';
    }
    const res = await hrSave(COL_FILES, data);
    if (res.error) return { error: res.error };
    revalidatePath(ROUTE_BASE);
    return { message: 'File saved.', id: res.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to save file';
    return { error: msg };
  }
}

export async function deleteFile(id: string) {
  const res = await hrDelete(COL_FILES, id);
  revalidatePath(ROUTE_BASE);
  return res;
}

/* ────────────────────────────────────────────────────────────────
 *  uploadFile — metadata-only stub
 *
 *  Persists a record for an already-hosted file. No blob storage
 *  is performed here; the caller is expected to supply `url`.
 * ─────────────────────────────────────────────────────────────── */

interface WsUploadFileInput {
  filename: string;
  display_name?: string;
  url: string;
  size_bytes?: number;
  mime_type?: string;
  extension?: string;
  storage_location?: string;
  folder_id?: string;
  description?: string;
  is_public?: boolean;
  attached_to_type?: WsFileAttachableType;
  attached_to_id?: string;
}

export async function uploadFile(
  input: WsUploadFileInput,
): Promise<{ id?: string; error?: string }> {
  const user = await requireSession();
  if (!user) return { error: 'Access denied' };
  if (!input?.filename || !input?.url) {
    return { error: 'filename and url are required' };
  }

  const extension =
    input.extension ||
    (input.filename.includes('.')
      ? input.filename.split('.').pop()?.toLowerCase() || ''
      : '');

  const res = await hrSave(COL_FILES, {
    filename: input.filename,
    display_name: input.display_name || input.filename,
    storage_location: input.storage_location || 'external',
    url: input.url,
    size_bytes: Number(input.size_bytes || 0),
    mime_type: input.mime_type || '',
    extension,
    uploaded_by_user_id: user._id,
    folder_id: input.folder_id,
    description: input.description || '',
    is_public: Boolean(input.is_public),
    attached_to_type: input.attached_to_type,
    attached_to_id: input.attached_to_id,
  });
  revalidatePath(ROUTE_BASE);
  return res;
}

/* ────────────────────────────────────────────────────────────────
 *  Attach / Detach / Lookup
 * ─────────────────────────────────────────────────────────────── */

export async function attachFileTo(
  fileId: string,
  type: WsFileAttachableType,
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireSession();
  if (!user) return { ok: false, error: 'Access denied' };
  if (!ObjectId.isValid(fileId)) return { ok: false, error: 'Invalid fileId' };
  const { db } = await connectToDatabase();
  await db.collection(COL_FILES).updateOne(
    {
      _id: new ObjectId(fileId),
      userId: new ObjectId(user._id),
    },
    {
      $set: {
        attached_to_type: type,
        attached_to_id: String(id),
        updatedAt: new Date(),
      },
    },
  );
  revalidatePath(ROUTE_BASE);
  return { ok: true };
}

export async function detachFile(
  fileId: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireSession();
  if (!user) return { ok: false, error: 'Access denied' };
  if (!ObjectId.isValid(fileId)) return { ok: false, error: 'Invalid fileId' };
  const { db } = await connectToDatabase();
  await db.collection(COL_FILES).updateOne(
    {
      _id: new ObjectId(fileId),
      userId: new ObjectId(user._id),
    },
    {
      $unset: { attached_to_type: '', attached_to_id: '' },
      $set: { updatedAt: new Date() },
    },
  );
  revalidatePath(ROUTE_BASE);
  return { ok: true };
}

export async function getFilesAttachedTo(
  type: WsFileAttachableType,
  id: string,
): Promise<WsFileStorage[]> {
  const user = await requireSession();
  if (!user) return [];
  const { db } = await connectToDatabase();
  const docs = await db
    .collection(COL_FILES)
    .find({
      userId: new ObjectId(user._id),
      attached_to_type: type,
      attached_to_id: String(id),
    })
    .sort({ createdAt: -1 })
    .toArray();
  return serialize(docs) as WsFileStorage[];
}

/* ────────────────────────────────────────────────────────────────
 *  Folder tree
 * ─────────────────────────────────────────────────────────────── */

export async function getFolderTree(): Promise<WsFolderTreeNode[]> {
  const folders = await getFileFolders();
  const byId = new Map<string, WsFolderTreeNode>();
  for (const f of folders) {
    byId.set(String(f._id), { ...(f as WsFileFolder), children: [] });
  }
  const roots: WsFolderTreeNode[] = [];
  for (const node of byId.values()) {
    const parentId = node.parent_folder_id;
    if (parentId && byId.has(parentId)) {
      byId.get(parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

/* ────────────────────────────────────────────────────────────────
 *  Bulk delete files
 * ─────────────────────────────────────────────────────────────── */

export async function bulkDeleteFiles(
  ids: string[],
): Promise<{ success: boolean; processed: number; error?: string }> {
  const user = await requireSession();
  if (!user) return { success: false, processed: 0, error: 'Access denied.' };
  const valid = (ids ?? []).filter((id) => typeof id === 'string' && ObjectId.isValid(id));
  if (valid.length === 0) return { success: false, processed: 0, error: 'No valid file ids.' };

  const { db } = await connectToDatabase();
  let processed = 0;
  for (const id of valid) {
    try {
      const result = await db.collection(COL_FILES).deleteOne({
        _id: new ObjectId(id),
        userId: new ObjectId(user._id),
      });
      if (result.deletedCount > 0) processed += 1;
    } catch {
      /* continue on per-row failure */
    }
  }
  revalidatePath(ROUTE_BASE);
  revalidatePath(`${ROUTE_BASE}/folders`);
  return { success: true, processed };
}

/* ────────────────────────────────────────────────────────────────
 *  File browser stats (KPI strip)
 * ─────────────────────────────────────────────────────────────── */

interface FileBrowserStats {
  totalFolders: number;
  totalFiles: number;
  totalStorageBytes: number;
  addedThisMonth: number;
}

export async function getFileBrowserStats(): Promise<FileBrowserStats> {
  const empty: FileBrowserStats = {
    totalFolders: 0,
    totalFiles: 0,
    totalStorageBytes: 0,
    addedThisMonth: 0,
  };
  const user = await requireSession();
  if (!user) return empty;

  try {
    const { db } = await connectToDatabase();
    const userId = new ObjectId(user._id);
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [totalFolders, totalFiles, storageAgg, addedThisMonth] = await Promise.all([
      db.collection(COL_FOLDERS).countDocuments({ userId } as Record<string, unknown>),
      db.collection(COL_FILES).countDocuments({ userId } as Record<string, unknown>),
      db
        .collection(COL_FILES)
        .aggregate([
          { $match: { userId } },
          { $group: { _id: null, total: { $sum: { $ifNull: ['$size_bytes', 0] } } } },
        ])
        .toArray(),
      db.collection(COL_FILES).countDocuments({
        userId,
        createdAt: { $gte: startOfMonth },
      } as Record<string, unknown>),
    ]);

    return {
      totalFolders: Number(totalFolders) || 0,
      totalFiles: Number(totalFiles) || 0,
      totalStorageBytes: Number((storageAgg[0] as { total?: number } | undefined)?.total ?? 0),
      addedThisMonth: Number(addedThisMonth) || 0,
    };
  } catch (e) {
    console.error('[getFileBrowserStats] failed:', e);
    return empty;
  }
}

/* ────────────────────────────────────────────────────────────────
 *  Create folder (simple named action for the UI button)
 * ─────────────────────────────────────────────────────────────── */

export async function createFolder(
  name: string,
  parentFolderId?: string,
): Promise<{ id?: string; error?: string }> {
  if (!name?.trim()) return { error: 'Folder name is required.' };
  const user = await requireSession();
  if (!user) return { error: 'Access denied.' };

  const { db } = await connectToDatabase();
  const doc = {
    userId: new ObjectId(user._id),
    name: name.trim(),
    parent_folder_id: parentFolderId || undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const result = await db.collection(COL_FOLDERS).insertOne(doc as Record<string, unknown>);
  revalidatePath(`${ROUTE_BASE}/folders`);
  revalidatePath(ROUTE_BASE);
  return { id: result.insertedId.toString() };
}
