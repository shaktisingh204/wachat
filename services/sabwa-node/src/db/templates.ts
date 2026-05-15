/**
 * `sabwa_templates` repository.
 *
 * Saved message templates with optional media + categories. The wire shape
 * matches `SabwaTemplate` in `src/lib/sabwa/types.ts`:
 *
 *   {
 *     _id: string,
 *     projectId?: string,
 *     sessionId?: string,
 *     name: string,
 *     category?: string,
 *     body: string,
 *     variables: string[],
 *     mediaSabFileId?: string,
 *     usageCount: number,
 *     createdAt: ISO-8601 string,
 *     updatedAt: ISO-8601 string,
 *   }
 *
 * IDs are emitted as hex strings (BSON `ObjectId` -> `toHexString()`); Mongo
 * is the source of truth for shape.
 */

import {
  Collection,
  Db,
  ObjectId,
  type Document,
  type Filter,
  type UpdateFilter,
} from 'mongodb';

export const TEMPLATES_COLLECTION = 'sabwa_templates';

export interface TemplateDto {
  _id: string;
  projectId?: string;
  sessionId?: string;
  name: string;
  category?: string;
  body: string;
  variables: string[];
  mediaSabFileId?: string;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplateInput {
  sessionId: string;
  projectId?: string;
  name: string;
  body: string;
  category?: string;
  variables?: string[];
  mediaSabFileId?: string;
}

export interface UpdateTemplateInput {
  name?: string;
  body?: string;
  category?: string;
  variables?: string[];
  mediaSabFileId?: string;
}

function collection(db: Db): Collection<Document> {
  return db.collection<Document>(TEMPLATES_COLLECTION);
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
 * Extract `${variable}`-style placeholders from a template body so the UI can
 * render variable chips without parsing on the client.
 */
function extractVariables(body: string): string[] {
  const out = new Set<string>();
  const re = /\$\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    if (m[1]) out.add(m[1]);
  }
  return Array.from(out);
}

function docToDto(d: Document | null): TemplateDto | null {
  if (!d) return null;
  const _id = toStringId(d._id);
  if (!_id) return null;
  const variables = Array.isArray(d.variables)
    ? (d.variables as unknown[]).filter((v): v is string => typeof v === 'string')
    : [];
  return {
    _id,
    projectId: toOptionalStringId(d.projectId),
    sessionId: toOptionalStringId(d.sessionId),
    name: typeof d.name === 'string' ? d.name : '',
    category: typeof d.category === 'string' ? d.category : undefined,
    body: typeof d.body === 'string' ? d.body : '',
    variables,
    mediaSabFileId:
      typeof d.mediaSabFileId === 'string' ? d.mediaSabFileId : undefined,
    usageCount: typeof d.usageCount === 'number' ? d.usageCount : 0,
    createdAt: toIsoString(d.createdAt),
    updatedAt: toIsoString(d.updatedAt ?? d.createdAt),
  };
}

export async function listTemplates(
  db: Db,
  sessionId: string,
): Promise<TemplateDto[]> {
  const filter: Filter<Document> = { sessionId: idValue(sessionId) };
  const docs = await collection(db)
    .find(filter)
    .sort({ createdAt: -1 })
    .toArray();
  return docs.map(docToDto).filter((x): x is TemplateDto => x !== null);
}

export async function createTemplate(
  db: Db,
  input: CreateTemplateInput,
): Promise<TemplateDto> {
  const now = new Date();
  const variables = Array.isArray(input.variables)
    ? input.variables
    : extractVariables(input.body);
  const doc: Document = {
    _id: new ObjectId(),
    sessionId: idValue(input.sessionId),
    name: input.name.trim(),
    body: input.body,
    variables,
    usageCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  if (input.projectId) doc.projectId = idValue(input.projectId);
  if (input.category) doc.category = input.category;
  if (input.mediaSabFileId) doc.mediaSabFileId = input.mediaSabFileId;

  await collection(db).insertOne(doc);
  const dto = docToDto(doc);
  if (!dto) throw new Error('failed to render created template');
  return dto;
}

export async function updateTemplate(
  db: Db,
  id: string,
  patch: UpdateTemplateInput,
): Promise<TemplateDto | null> {
  if (!ObjectId.isValid(id)) return null;
  const oid = new ObjectId(id);
  const set: Document = { updatedAt: new Date() };
  if (typeof patch.name === 'string') set.name = patch.name.trim();
  if (typeof patch.body === 'string') {
    set.body = patch.body;
    // Re-derive variables when body changes and caller didn't supply explicit list.
    if (!Array.isArray(patch.variables)) {
      set.variables = extractVariables(patch.body);
    }
  }
  if (typeof patch.category === 'string') set.category = patch.category;
  if (Array.isArray(patch.variables)) set.variables = patch.variables;
  if (typeof patch.mediaSabFileId === 'string') {
    set.mediaSabFileId = patch.mediaSabFileId;
  }

  const update: UpdateFilter<Document> = { $set: set };
  await collection(db).updateOne({ _id: oid }, update);
  const after = await collection(db).findOne({ _id: oid });
  return docToDto(after);
}

export async function deleteTemplate(db: Db, id: string): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false;
  const res = await collection(db).deleteOne({ _id: new ObjectId(id) });
  return res.deletedCount === 1;
}
