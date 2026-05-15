/**
 * `sabwa_quick_replies` repository.
 *
 * Slash-command snippets the operator can fire into a chat. Wire shape matches
 * `SabwaQuickReply` in `src/lib/sabwa/types.ts`:
 *
 *   {
 *     _id: string,
 *     projectId?: string,
 *     sessionId?: string,
 *     shortcut: string,        // e.g. "/thanks"
 *     body: string,
 *     mediaSabFileId?: string,
 *     createdAt: ISO-8601 string,
 *     updatedAt: ISO-8601 string,
 *   }
 */

import {
  Collection,
  Db,
  ObjectId,
  type Document,
  type Filter,
  type UpdateFilter,
} from 'mongodb';

export const QUICK_REPLIES_COLLECTION = 'sabwa_quick_replies';

export interface QuickReplyDto {
  _id: string;
  projectId?: string;
  sessionId?: string;
  shortcut: string;
  body: string;
  mediaSabFileId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateQuickReplyInput {
  sessionId: string;
  projectId?: string;
  shortcut: string;
  body: string;
  mediaSabFileId?: string;
}

export interface UpdateQuickReplyInput {
  shortcut?: string;
  body?: string;
  mediaSabFileId?: string;
}

function collection(db: Db): Collection<Document> {
  return db.collection<Document>(QUICK_REPLIES_COLLECTION);
}

function idValue(raw: string): ObjectId | string {
  return ObjectId.isValid(raw) && /^[a-fA-F0-9]{24}$/.test(raw)
    ? new ObjectId(raw)
    : raw;
}

function toStringId(value: unknown): string {
  if (value instanceof ObjectId) return value.toHexString();
  if (typeof value === 'string') return value;
  return '';
}

function toOptionalStringId(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (value instanceof ObjectId) return value.toHexString();
  if (typeof value === 'string') return value;
  return undefined;
}

function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return new Date().toISOString();
}

/**
 * Normalise the shortcut so callers can pass either `thanks` or `/thanks`.
 * We always persist the leading slash to match the `/cmd` UX in the chat box.
 */
function normaliseShortcut(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return trimmed;
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function docToDto(d: Document | null): QuickReplyDto | null {
  if (!d) return null;
  const _id = toStringId(d._id);
  if (!_id) return null;
  return {
    _id,
    projectId: toOptionalStringId(d.projectId),
    sessionId: toOptionalStringId(d.sessionId),
    shortcut: typeof d.shortcut === 'string' ? d.shortcut : '',
    body: typeof d.body === 'string' ? d.body : '',
    mediaSabFileId:
      typeof d.mediaSabFileId === 'string' ? d.mediaSabFileId : undefined,
    createdAt: toIsoString(d.createdAt),
    updatedAt: toIsoString(d.updatedAt ?? d.createdAt),
  };
}

export async function listQuickReplies(
  db: Db,
  sessionId: string,
): Promise<QuickReplyDto[]> {
  const filter: Filter<Document> = { sessionId: idValue(sessionId) };
  const docs = await collection(db)
    .find(filter)
    .sort({ shortcut: 1 })
    .toArray();
  return docs.map(docToDto).filter((x): x is QuickReplyDto => x !== null);
}

export async function createQuickReply(
  db: Db,
  input: CreateQuickReplyInput,
): Promise<QuickReplyDto> {
  const now = new Date();
  const doc: Document = {
    _id: new ObjectId(),
    sessionId: idValue(input.sessionId),
    shortcut: normaliseShortcut(input.shortcut),
    body: input.body,
    createdAt: now,
    updatedAt: now,
  };
  if (input.projectId) doc.projectId = idValue(input.projectId);
  if (input.mediaSabFileId) doc.mediaSabFileId = input.mediaSabFileId;

  await collection(db).insertOne(doc);
  const dto = docToDto(doc);
  if (!dto) throw new Error('failed to render created quick reply');
  return dto;
}

export async function updateQuickReply(
  db: Db,
  id: string,
  patch: UpdateQuickReplyInput,
): Promise<QuickReplyDto | null> {
  if (!ObjectId.isValid(id)) return null;
  const oid = new ObjectId(id);
  const set: Document = { updatedAt: new Date() };
  if (typeof patch.shortcut === 'string') {
    set.shortcut = normaliseShortcut(patch.shortcut);
  }
  if (typeof patch.body === 'string') set.body = patch.body;
  if (typeof patch.mediaSabFileId === 'string') {
    set.mediaSabFileId = patch.mediaSabFileId;
  }

  const update: UpdateFilter<Document> = { $set: set };
  await collection(db).updateOne({ _id: oid }, update);
  const after = await collection(db).findOne({ _id: oid });
  return docToDto(after);
}

export async function deleteQuickReply(db: Db, id: string): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false;
  const res = await collection(db).deleteOne({ _id: new ObjectId(id) });
  return res.deletedCount === 1;
}
