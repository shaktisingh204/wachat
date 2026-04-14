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

export interface WsUploadFileInput {
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
