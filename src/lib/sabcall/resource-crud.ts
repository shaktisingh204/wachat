import 'server-only';

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSabcallWorkspaceId } from '@/lib/sabcall/workspace';

/**
 * Project-scoped direct-Mongo CRUD factory for SabCall resources.
 *
 * Every SabCall collection is tenanted by `userId` = the active project's id
 * (the workspace id), exactly like `sabcall.actions.ts` and what the
 * `sabcall-engine` reads. We use direct Mongo (not the Rust crates) as the
 * primary path so the tenant scope is unambiguously the project — the Rust
 * `user_oid` path keys off the JWT subject (the session user), which would
 * NOT isolate per project. The crates remain a forward-compatible mirror.
 *
 * Return shapes match the Rust crate responses the pages were written against:
 *   list   → { items, page, limit, hasMore }
 *   create → { id, entity }
 *   update → entity
 *   delete → { deleted }
 */

async function workspaceId(): Promise<string> {
  const id = await getSabcallWorkspaceId();
  if (!id) throw new Error('No SabCall project selected.');
  return id;
}

function toOid(id?: string): ObjectId | null {
  if (!id) return null;
  try {
    return new ObjectId(id);
  } catch {
    return null;
  }
}

function withStringId<T extends { _id: unknown }>(doc: T): T & { _id: string } {
  return { ...doc, _id: String(doc._id) } as T & { _id: string };
}

export interface ResourceListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: string;
  [k: string]: unknown;
}

export interface ResourceCrudOptions {
  /** Fields a `q` search matches (case-insensitive regex OR). */
  searchFields: string[];
  /** Path to revalidate on mutation. */
  revalidate: string;
  /** Extra equality filters pulled from list params (e.g. `provider`, `vip`). */
  extraFilters?: string[];
}

export function makeSabcallResource(collection: string, opts: ResourceCrudOptions) {
  return {
    async list<P extends object = ResourceListParams>(rawParams?: P) {
      const params = (rawParams ?? {}) as ResourceListParams;
      const userId = await workspaceId();
      const { db } = await connectToDatabase();
      const filter: Record<string, unknown> = { userId };
      if (params.status && params.status !== 'all') filter.status = params.status;
      for (const f of opts.extraFilters ?? []) {
        const v = params[f];
        if (v !== undefined && v !== null && v !== '') filter[f] = v;
      }
      if (params.q) {
        filter.$or = opts.searchFields.map((f) => ({
          [f]: { $regex: String(params.q), $options: 'i' },
        }));
      }
      const limit = Math.min(Number(params.limit ?? 50), 200);
      const page = Number(params.page ?? 0);
      const rows = await db
        .collection(collection)
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(page * limit)
        .limit(limit + 1)
        .toArray();
      const hasMore = rows.length > limit;
      if (hasMore) rows.pop();
      return { items: rows.map((r) => withStringId(r as { _id: unknown })), page, limit, hasMore };
    },

    async create<I extends object>(rawInput: I) {
      const input = rawInput as Record<string, unknown>;
      const userId = await workspaceId();
      const { db } = await connectToDatabase();
      const now = new Date();
      const doc: Record<string, unknown> = {
        ...input,
        userId,
        status: (input.status as string) ?? 'active',
        createdAt: now,
        updatedAt: now,
      };
      const res = await db.collection(collection).insertOne(doc as never);
      revalidatePath(opts.revalidate);
      return { id: String(res.insertedId), entity: withStringId({ ...doc, _id: res.insertedId }) };
    },

    async update<I extends object>(id: string, rawPatch: I) {
      const patch = rawPatch as Record<string, unknown>;
      const userId = await workspaceId();
      const _id = toOid(id);
      if (!_id) throw new Error('Invalid id.');
      const { db } = await connectToDatabase();
      const set: Record<string, unknown> = { ...patch, updatedAt: new Date() };
      delete set._id;
      delete set.userId;
      delete set.createdAt;
      await db.collection(collection).updateOne({ _id, userId }, { $set: set });
      const row = await db.collection(collection).findOne({ _id, userId });
      revalidatePath(opts.revalidate);
      return row ? withStringId(row as { _id: unknown }) : null;
    },

    async remove(id: string) {
      const userId = await workspaceId();
      const _id = toOid(id);
      if (!_id) throw new Error('Invalid id.');
      const { db } = await connectToDatabase();
      await db.collection(collection).deleteOne({ _id, userId });
      revalidatePath(opts.revalidate);
      return { deleted: true };
    },
  };
}
