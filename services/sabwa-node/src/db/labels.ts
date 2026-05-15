/**
 * `sabwa_labels` repository.
 *
 * Chat labels for the SabWa inbox. The wire shape matches `SabwaLabelRow` in
 * `src/app/actions/sabwa.actions.ts` — Next.js renders directly off this:
 *
 *   { id, name, color, chatCount?, createdAt? }
 *
 * `chatCount` is computed lazily — left out here in Phase 1 so the UI shows
 * `0` until the chats agent surfaces a per-label tally. `createdAt` is an
 * ISO-8601 string so it round-trips cleanly through Next.js JSON responses.
 */

import {
  Collection,
  Db,
  ObjectId,
  type Document,
  type Filter,
  type UpdateFilter,
} from 'mongodb';

export const LABELS_COLLECTION = 'sabwa_labels';

export interface LabelDto {
  id: string;
  name: string;
  color: string;
  order?: number;
  createdAt?: string;
}

export interface CreateLabelInput {
  sessionId: string;
  projectId?: string;
  name: string;
  color: string;
  order?: number;
}

export interface UpdateLabelInput {
  name?: string;
  color?: string;
  order?: number;
}

function collection(db: Db): Collection<Document> {
  return db.collection<Document>(LABELS_COLLECTION);
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

function toIsoString(value: unknown): string | undefined {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return undefined;
}

function docToDto(d: Document | null): LabelDto | null {
  if (!d) return null;
  const id = toStringId(d._id);
  if (!id) return null;
  return {
    id,
    name: typeof d.name === 'string' ? d.name : '',
    color: typeof d.color === 'string' ? d.color : '#64748b',
    order: typeof d.order === 'number' ? d.order : undefined,
    createdAt: toIsoString(d.createdAt),
  };
}

export async function listLabels(db: Db, sessionId: string): Promise<LabelDto[]> {
  const filter: Filter<Document> = { sessionId: idValue(sessionId) };
  const docs = await collection(db)
    .find(filter)
    .sort({ order: 1, createdAt: 1 })
    .toArray();
  return docs.map(docToDto).filter((x): x is LabelDto => x !== null);
}

export async function createLabel(
  db: Db,
  input: CreateLabelInput,
): Promise<LabelDto> {
  const now = new Date();
  const doc: Document = {
    _id: new ObjectId(),
    sessionId: idValue(input.sessionId),
    name: input.name.trim(),
    color: input.color,
    createdAt: now,
    updatedAt: now,
  };
  if (input.projectId) doc.projectId = idValue(input.projectId);
  if (typeof input.order === 'number') doc.order = input.order;

  await collection(db).insertOne(doc);
  const dto = docToDto(doc);
  if (!dto) throw new Error('failed to render created label');
  return dto;
}

export async function updateLabel(
  db: Db,
  id: string,
  patch: UpdateLabelInput,
): Promise<LabelDto | null> {
  if (!ObjectId.isValid(id)) return null;
  const oid = new ObjectId(id);
  const set: Document = { updatedAt: new Date() };
  if (typeof patch.name === 'string') set.name = patch.name.trim();
  if (typeof patch.color === 'string') set.color = patch.color;
  if (typeof patch.order === 'number') set.order = patch.order;

  const update: UpdateFilter<Document> = { $set: set };
  await collection(db).updateOne({ _id: oid }, update);
  const after = await collection(db).findOne({ _id: oid });
  return docToDto(after);
}

export async function deleteLabel(db: Db, id: string): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false;
  const res = await collection(db).deleteOne({ _id: new ObjectId(id) });
  return res.deletedCount === 1;
}
