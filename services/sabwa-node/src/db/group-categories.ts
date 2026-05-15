/**
 * `sabwa_group_categories` repository.
 *
 * User-defined groupings of WhatsApp groups, scoped per session. Lives on the
 * SabNode side only — never round-trips to WA. Mirrors the Rust collection in
 * `services/sabwa-engine/src/routes/group_categories.rs`.
 *
 * Wire shape (canonical, consumed by Next.js as `SabwaGroupCategory`):
 *
 *   {
 *     id: string,            // 24-char hex of `_id`
 *     sessionId: string,
 *     name: string,
 *     color?: string,
 *     icon?: string,
 *     order: number,
 *     groupJids: string[],
 *     groupCount: number,
 *     createdAt: ISO-8601 string,
 *     updatedAt: ISO-8601 string,
 *   }
 *
 * The stored BSON document keeps `_id`/`sessionId`/`projectId` as `ObjectId`
 * when the caller supplied a valid 24-hex id, falling back to plain strings
 * for legacy Phase-1 rows the Rust engine left behind.
 */

import {
  Collection,
  Db,
  ObjectId,
  type Document,
  type Filter,
  type UpdateFilter,
} from 'mongodb';

export const GROUP_CATEGORIES_COLLECTION = 'sabwa_group_categories';

export interface GroupCategoryDto {
  id: string;
  sessionId: string;
  name: string;
  color?: string;
  icon?: string;
  order: number;
  groupJids: string[];
  groupCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGroupCategoryInput {
  sessionId: string;
  projectId?: string;
  name: string;
  color?: string;
  icon?: string;
  order?: number;
  groupJids?: string[];
}

export interface UpdateGroupCategoryInput {
  name?: string;
  color?: string;
  icon?: string;
  order?: number;
  groupJids?: string[];
}

function collection(db: Db): Collection<Document> {
  return db.collection<Document>(GROUP_CATEGORIES_COLLECTION);
}

/** Sessions are stored as ObjectId when valid, plain string for legacy rows. */
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

function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return new Date().toISOString();
}

function docToDto(d: Document | null): GroupCategoryDto | null {
  if (!d) return null;
  const id = toStringId(d._id);
  if (!id) return null;
  const groupJids = Array.isArray(d.groupJids)
    ? (d.groupJids as unknown[]).filter((v): v is string => typeof v === 'string')
    : [];
  return {
    id,
    sessionId: toStringId(d.sessionId),
    name: typeof d.name === 'string' ? d.name : '',
    color: typeof d.color === 'string' ? d.color : undefined,
    icon: typeof d.icon === 'string' ? d.icon : undefined,
    order: typeof d.order === 'number' ? d.order : 0,
    groupJids,
    groupCount: groupJids.length,
    createdAt: toIsoString(d.createdAt),
    updatedAt: toIsoString(d.updatedAt ?? d.createdAt),
  };
}

export async function listGroupCategories(
  db: Db,
  sessionId: string,
): Promise<GroupCategoryDto[]> {
  const filter: Filter<Document> = { sessionId: idValue(sessionId) };
  const docs = await collection(db)
    .find(filter)
    .sort({ order: 1, createdAt: 1 })
    .toArray();
  return docs.map(docToDto).filter((x): x is GroupCategoryDto => x !== null);
}

export async function createGroupCategory(
  db: Db,
  input: CreateGroupCategoryInput,
): Promise<GroupCategoryDto> {
  const now = new Date();
  const doc: Document = {
    _id: new ObjectId(),
    sessionId: idValue(input.sessionId),
    name: input.name.trim(),
    order: typeof input.order === 'number' ? input.order : 0,
    groupJids: Array.isArray(input.groupJids) ? input.groupJids : [],
    createdAt: now,
    updatedAt: now,
  };
  if (input.projectId) doc.projectId = idValue(input.projectId);
  if (input.color) doc.color = input.color;
  if (input.icon) doc.icon = input.icon;

  await collection(db).insertOne(doc);
  const dto = docToDto(doc);
  if (!dto) throw new Error('failed to render created group category');
  return dto;
}

export async function updateGroupCategory(
  db: Db,
  id: string,
  patch: UpdateGroupCategoryInput,
): Promise<GroupCategoryDto | null> {
  if (!ObjectId.isValid(id)) return null;
  const oid = new ObjectId(id);
  const set: Document = { updatedAt: new Date() };
  if (typeof patch.name === 'string') set.name = patch.name.trim();
  if (typeof patch.color === 'string') set.color = patch.color;
  if (typeof patch.icon === 'string') set.icon = patch.icon;
  if (typeof patch.order === 'number') set.order = patch.order;
  if (Array.isArray(patch.groupJids)) set.groupJids = patch.groupJids;

  const update: UpdateFilter<Document> = { $set: set };
  await collection(db).updateOne({ _id: oid }, update);
  const after = await collection(db).findOne({ _id: oid });
  return docToDto(after);
}

export async function deleteGroupCategory(db: Db, id: string): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false;
  const res = await collection(db).deleteOne({ _id: new ObjectId(id) });
  return res.deletedCount === 1;
}
