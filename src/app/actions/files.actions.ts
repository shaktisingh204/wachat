'use server';

import 'server-only';
import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { buildFileKey, deleteFromR2, uploadToR2 } from '@/lib/r2';
import { recordFlowAction } from '@/lib/sabflow/audit/middleware';

const COLLECTION = 'user_files';

export type LibraryFileTag =
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'other';

export interface LibraryFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  tag: LibraryFileTag;
  url: string;
  key: string;
  createdAt: string;
}

export interface FileDoc {
  _id?: ObjectId;
  userId: string;
  name: string;
  mimeType: string;
  size: number;
  tag: LibraryFileTag;
  url: string;
  key: string;
  createdAt: Date;
  updatedAt: Date;
}

function toLibraryFile(doc: FileDoc): LibraryFile {
  return {
    id: String(doc._id),
    name: doc.name,
    mimeType: doc.mimeType,
    size: doc.size,
    tag: doc.tag,
    url: doc.url,
    key: doc.key,
    createdAt: doc.createdAt.toISOString(),
  };
}

function tagFor(mime: string): LibraryFileTag {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (
    mime === 'application/pdf' ||
    mime.startsWith('application/vnd.') ||
    mime.startsWith('text/')
  ) {
    return 'document';
  }
  return 'other';
}

async function requireUserId(): Promise<string> {
  const session = await getSession();
  const id = (session as any)?.user?._id ?? (session as any)?.user?.id;
  if (!id) throw new Error('Not authenticated');
  return String(id);
}

export interface ListFilesArgs {
  tag?: LibraryFileTag;
  search?: string;
  limit?: number;
  cursor?: string;
}

export async function listLibraryFiles(args: ListFilesArgs = {}): Promise<{
  items: LibraryFile[];
  nextCursor: string | null;
}> {
  const userId = await requireUserId();
  const { db } = await connectToDatabase();

  const limit = Math.min(Math.max(args.limit ?? 24, 1), 100);
  const filter: Record<string, unknown> = { userId };
  if (args.tag) filter.tag = args.tag;
  if (args.search?.trim()) filter.name = { $regex: args.search.trim(), $options: 'i' };
  if (args.cursor) {
    try {
      filter._id = { $lt: new ObjectId(args.cursor) };
    } catch {
      // ignore malformed cursor
    }
  }

  const docs = await db
    .collection<FileDoc>(COLLECTION)
    .find(filter)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .toArray();

  const hasMore = docs.length > limit;
  const page = hasMore ? docs.slice(0, limit) : docs;
  const nextCursor = hasMore ? String(page[page.length - 1]._id) : null;

  return { items: page.map(toLibraryFile), nextCursor };
}

export async function uploadLibraryFile(formData: FormData): Promise<LibraryFile> {
  const userId = await requireUserId();
  const file = formData.get('file');
  if (!(file instanceof File)) {
    throw new Error('No file provided');
  }
  if (file.size === 0) throw new Error('File is empty');
  if (file.size > 100 * 1024 * 1024) {
    throw new Error('File exceeds 100 MB limit');
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const key = buildFileKey(userId, file.name);
  const mime = file.type || 'application/octet-stream';

  const uploaded = await uploadToR2({
    key,
    body: buffer,
    contentType: mime,
    metadata: { userId, originalName: file.name },
  });

  const now = new Date();
  const { db } = await connectToDatabase();
  const insert = await db.collection<FileDoc>(COLLECTION).insertOne({
    userId,
    name: file.name,
    mimeType: mime,
    size: uploaded.size,
    tag: tagFor(mime),
    url: uploaded.url,
    key: uploaded.key,
    createdAt: now,
    updatedAt: now,
  });

  revalidatePath('/dashboard');

  void recordFlowAction('sabfile.uploaded', {
    userId,
    target: String(insert.insertedId),
    metadata: {
      name: file.name,
      size: uploaded.size,
      mime,
      surface: 'library',
    },
  });

  return toLibraryFile({
    _id: insert.insertedId,
    userId,
    name: file.name,
    mimeType: mime,
    size: uploaded.size,
    tag: tagFor(mime),
    url: uploaded.url,
    key: uploaded.key,
    createdAt: now,
    updatedAt: now,
  });
}

export async function renameLibraryFile(id: string, name: string): Promise<void> {
  const userId = await requireUserId();
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Name cannot be empty');
  const { db } = await connectToDatabase();
  await db.collection<FileDoc>(COLLECTION).updateOne(
    { _id: new ObjectId(id), userId },
    { $set: { name: trimmed.slice(0, 200), updatedAt: new Date() } },
  );
  void recordFlowAction('sabfile.renamed', {
    userId,
    target: id,
    metadata: { name: trimmed.slice(0, 200), surface: 'library' },
  });
}

export async function deleteLibraryFile(id: string): Promise<void> {
  const userId = await requireUserId();
  const { db } = await connectToDatabase();
  const doc = await db.collection<FileDoc>(COLLECTION).findOne({
    _id: new ObjectId(id),
    userId,
  });
  if (!doc) return;
  await deleteFromR2(doc.key).catch(() => {
    // Continue even if R2 delete fails — DB row goes; orphan key can be GC'd later.
  });
  await db.collection<FileDoc>(COLLECTION).deleteOne({ _id: doc._id });
  void recordFlowAction('sabfile.deleted', {
    userId,
    target: id,
    metadata: { name: doc.name, surface: 'library' },
  });
}

export async function getLibraryFile(id: string): Promise<LibraryFile | null> {
  const userId = await requireUserId();
  const { db } = await connectToDatabase();
  const doc = await db.collection<FileDoc>(COLLECTION).findOne({
    _id: new ObjectId(id),
    userId,
  });
  return doc ? toLibraryFile(doc) : null;
}
