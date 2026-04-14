import { ObjectId, type Db, type Filter, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';

/**
 * Shared HR CRUD utilities. These run on the server but live in a
 * lib file (not a 'use server' module) so they can be imported by
 * multiple action modules and compose freely.
 *
 * Tenant isolation: every document carries `userId`. Queries are
 * scoped to the authenticated user; no cross-tenant reads are
 * possible through these helpers.
 */

export type SessionUser = { _id: string };

export async function requireSession(): Promise<SessionUser | null> {
  const session = await getSession();
  if (!session?.user) return null;
  return { _id: String(session.user._id) };
}

/** ObjectId-coerce every field listed in `idFields` (tolerates undefined). */
function coerceIds<T extends Record<string, any>>(input: T, idFields: (keyof T)[]): T {
  const out: any = { ...input };
  for (const k of idFields) {
    const v = input[k];
    if (typeof v === 'string' && ObjectId.isValid(v)) {
      out[k] = new ObjectId(v);
    }
  }
  return out;
}

/** Coerce ISO date strings on listed fields to Date. */
function coerceDates<T extends Record<string, any>>(input: T, dateFields: (keyof T)[]): T {
  const out: any = { ...input };
  for (const k of dateFields) {
    const v = input[k];
    if (typeof v === 'string' && v) {
      const d = new Date(v);
      if (!isNaN(d.getTime())) out[k] = d;
    }
  }
  return out;
}

/** Serialize a MongoDB document for transfer to the client (strips ObjectId types). */
export function serialize<T>(doc: T): T {
  return JSON.parse(JSON.stringify(doc));
}

export interface HrCrudOptions {
  idFields?: string[];
  dateFields?: string[];
  sortBy?: Record<string, 1 | -1>;
  extraFilter?: Filter<any>;
}

export async function hrList<T>(
  collection: string,
  opts: HrCrudOptions = {},
): Promise<WithId<T>[]> {
  const user = await requireSession();
  if (!user) return [];
  const { db } = await connectToDatabase();
  const filter: Filter<any> = {
    userId: new ObjectId(user._id),
    ...(opts.extraFilter || {}),
  };
  const docs = await db
    .collection(collection)
    .find(filter)
    .sort(opts.sortBy ?? { createdAt: -1 })
    .toArray();
  return serialize(docs) as WithId<T>[];
}

export async function hrGetById<T>(
  collection: string,
  id: string,
): Promise<WithId<T> | null> {
  const user = await requireSession();
  if (!user || !ObjectId.isValid(id)) return null;
  const { db } = await connectToDatabase();
  const doc = await db
    .collection(collection)
    .findOne({ _id: new ObjectId(id), userId: new ObjectId(user._id) });
  return doc ? (serialize(doc) as WithId<T>) : null;
}

export async function hrSave(
  collection: string,
  payload: Record<string, any>,
  opts: HrCrudOptions = {},
): Promise<{ id?: string; error?: string }> {
  const user = await requireSession();
  if (!user) return { error: 'Access denied' };
  const { db } = await connectToDatabase();
  const { _id, ...rest } = payload;
  const now = new Date();
  let data = coerceIds(rest, (opts.idFields || []) as any);
  data = coerceDates(data, (opts.dateFields || []) as any);
  data.userId = new ObjectId(user._id);
  data.updatedAt = now;

  if (_id && typeof _id === 'string' && ObjectId.isValid(_id)) {
    await db
      .collection(collection)
      .updateOne(
        { _id: new ObjectId(_id), userId: new ObjectId(user._id) },
        { $set: data },
      );
    return { id: _id };
  }
  data.createdAt = now;
  const res = await db.collection(collection).insertOne(data);
  return { id: res.insertedId.toString() };
}

export async function hrDelete(
  collection: string,
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireSession();
  if (!user) return { success: false, error: 'Access denied' };
  if (!ObjectId.isValid(id)) return { success: false, error: 'Invalid id' };
  const { db } = await connectToDatabase();
  await db.collection(collection).deleteOne({
    _id: new ObjectId(id),
    userId: new ObjectId(user._id),
  });
  return { success: true };
}

/** Parse FormData into a plain object, converting known numeric keys. */
export function formToObject(
  formData: FormData,
  numericKeys: string[] = [],
): Record<string, any> {
  const obj: Record<string, any> = {};
  formData.forEach((v, k) => {
    obj[k] = typeof v === 'string' ? v : v;
  });
  for (const k of numericKeys) {
    if (obj[k] !== undefined && obj[k] !== '') obj[k] = Number(obj[k]);
  }
  return obj;
}
