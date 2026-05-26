'use server';

/**
 * CRM KB Categories — server actions.
 *
 * Mirrors `crm-knowledge-base.actions.ts` shape. Dual-impl: prefers the
 * Rust BFF (`crmKbCategoriesApi`) when `USE_RUST_CRM=true`, falls back to
 * raw Mongo on the `crm_kb_categories` collection.
 *
 * Tenant scope: every doc carries `userId` (string of `session.user._id`)
 * and queries always filter by it.
 */

import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
  crmKbCategoriesApi,
  type CrmKbCategoryDoc,
} from '@/lib/rust-client/crm-kb-categories';

const COLL = 'crm_kb_categories';
const LIST_PATH = '/dashboard/sabdesk/kb';

function useRustCrm(): boolean {
  return process.env.USE_RUST_CRM === 'true';
}

export interface KbCategoryRow {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  parentId?: string | null;
  order?: number;
  visibility?: 'internal' | 'portal' | 'public' | string;
  articleCount?: number;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

function normalise(doc: Record<string, unknown> | CrmKbCategoryDoc): KbCategoryRow {
  const d = doc as Record<string, unknown>;
  const parent = d.parentId;
  return {
    _id: String(d._id ?? ''),
    name: String(d.name ?? 'Untitled'),
    slug: String(d.slug ?? ''),
    description: d.description ? String(d.description) : undefined,
    icon: d.icon ? String(d.icon) : undefined,
    parentId: parent == null ? null : String(parent),
    order: typeof d.order === 'number' ? d.order : 0,
    visibility: d.visibility ? String(d.visibility) : 'portal',
    articleCount: typeof d.articleCount === 'number' ? d.articleCount : 0,
    status: d.status ? String(d.status) : 'active',
    createdAt: d.createdAt ? new Date(d.createdAt as string).toISOString() : undefined,
    updatedAt: d.updatedAt ? new Date(d.updatedAt as string).toISOString() : undefined,
  };
}

export async function listKbCategories(params?: {
  visibility?: 'internal' | 'portal' | 'public';
  includeArchived?: boolean;
}): Promise<{ categories: KbCategoryRow[]; error?: string }> {
  const session = await getSession();
  if (!session?.user?._id) return { categories: [], error: 'Access denied.' };

  if (useRustCrm()) {
    try {
      const res = await crmKbCategoriesApi.list({
        status: params?.includeArchived ? 'all' : 'active',
        visibility: params?.visibility,
        limit: 500,
      });
      return { categories: (res.items ?? []).map(normalise) };
    } catch (e) {
      console.error('[listKbCategories] rust path failed; falling back:', e);
      recordRustFallback({
        entity: 'kb_category',
        op: 'list',
        errorCode: e instanceof RustApiError ? e.code : undefined,
        status: e instanceof RustApiError ? e.status : undefined,
      });
    }
  }

  try {
    const { db } = await connectToDatabase();
    const filter: Record<string, unknown> = {
      userId: new ObjectId(session.user._id as string),
    };
    if (!params?.includeArchived) filter.status = { $ne: 'archived' };
    if (params?.visibility) filter.visibility = params.visibility;
    const docs = await db
      .collection(COLL)
      .find(filter)
      .sort({ order: 1, name: 1 })
      .limit(500)
      .toArray();
    return { categories: docs.map(normalise) };
  } catch (e) {
    console.error('[listKbCategories] mongo path failed:', e);
    return { categories: [], error: 'Failed to load categories.' };
  }
}

export async function saveKbCategory(
  _prev: unknown,
  formData: FormData,
): Promise<{ success: boolean; id?: string; error?: string }> {
  const session = await getSession();
  if (!session?.user?._id) return { success: false, error: 'Access denied.' };

  const idRaw = (formData.get('_id') as string | null)?.trim() || '';
  const name = (formData.get('name') as string | null)?.trim() || '';
  if (!name) return { success: false, error: 'Category name is required.' };

  const slug = (formData.get('slug') as string | null)?.trim() || undefined;
  const description = (formData.get('description') as string | null)?.trim() || undefined;
  const icon = (formData.get('icon') as string | null)?.trim() || undefined;
  const parentId = (formData.get('parentId') as string | null)?.trim() || undefined;
  const orderRaw = (formData.get('order') as string | null) ?? '';
  const order = orderRaw === '' ? undefined : Number.parseInt(orderRaw, 10);
  const visibility =
    ((formData.get('visibility') as string | null)?.trim() as
      | 'internal'
      | 'portal'
      | 'public'
      | undefined) || undefined;

  const payload = {
    name,
    slug,
    description,
    icon,
    parentId: parentId && parentId !== 'root' ? parentId : undefined,
    order: Number.isFinite(order ?? NaN) ? order : undefined,
    visibility,
  };

  try {
    if (idRaw && ObjectId.isValid(idRaw)) {
      if (useRustCrm()) {
        try {
          await crmKbCategoriesApi.update(idRaw, payload);
          revalidatePath(LIST_PATH);
          return { success: true, id: idRaw };
        } catch (e) {
          console.error('[saveKbCategory] rust update failed; falling back:', e);
          recordRustFallback({
            entity: 'kb_category',
            op: 'update',
            errorCode: e instanceof RustApiError ? e.code : undefined,
            status: e instanceof RustApiError ? e.status : undefined,
          });
        }
      }
      const { db } = await connectToDatabase();
      const set: Record<string, unknown> = {
        name,
        updatedAt: new Date(),
      };
      if (slug) set.slug = slug;
      if (description !== undefined) set.description = description;
      if (icon !== undefined) set.icon = icon;
      if (visibility) set.visibility = visibility;
      if (Number.isFinite(order ?? NaN)) set.order = order;
      const update: Record<string, unknown> = { $set: set };
      if (payload.parentId) {
        set.parentId = ObjectId.isValid(payload.parentId)
          ? new ObjectId(payload.parentId)
          : payload.parentId;
      } else if (parentId === 'root') {
        update.$unset = { parentId: '' };
      }
      await db.collection(COLL).updateOne(
        {
          _id: new ObjectId(idRaw),
          userId: new ObjectId(session.user._id as string),
        },
        update,
      );
      revalidatePath(LIST_PATH);
      return { success: true, id: idRaw };
    }

    if (useRustCrm()) {
      try {
        const res = await crmKbCategoriesApi.create(payload);
        revalidatePath(LIST_PATH);
        return { success: true, id: res.id };
      } catch (e) {
        console.error('[saveKbCategory] rust create failed; falling back:', e);
        recordRustFallback({
          entity: 'kb_category',
          op: 'create',
          errorCode: e instanceof RustApiError ? e.code : undefined,
          status: e instanceof RustApiError ? e.status : undefined,
        });
      }
    }
    const { db } = await connectToDatabase();
    const slugified =
      slug ??
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    const now = new Date();
    const doc = {
      userId: new ObjectId(session.user._id as string),
      name,
      slug: slugified,
      description,
      icon,
      parentId:
        payload.parentId && ObjectId.isValid(payload.parentId)
          ? new ObjectId(payload.parentId)
          : null,
      order: Number.isFinite(order ?? NaN) ? order : 0,
      visibility: visibility ?? 'portal',
      articleCount: 0,
      status: 'active',
      createdAt: now,
    };
    const ins = await db.collection(COLL).insertOne(doc);
    revalidatePath(LIST_PATH);
    return { success: true, id: String(ins.insertedId) };
  } catch (e) {
    console.error('[saveKbCategory] failed:', e);
    return { success: false, error: 'Failed to save category.' };
  }
}

export async function deleteKbCategory(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  if (!id || !ObjectId.isValid(id)) return { success: false, error: 'Invalid id.' };
  const session = await getSession();
  if (!session?.user?._id) return { success: false, error: 'Access denied.' };

  if (useRustCrm()) {
    try {
      await crmKbCategoriesApi.delete(id);
      revalidatePath(LIST_PATH);
      return { success: true };
    } catch (e) {
      console.error('[deleteKbCategory] rust path failed; falling back:', e);
      recordRustFallback({
        entity: 'kb_category',
        op: 'delete',
        errorCode: e instanceof RustApiError ? e.code : undefined,
        status: e instanceof RustApiError ? e.status : undefined,
      });
    }
  }

  try {
    const { db } = await connectToDatabase();
    await db.collection(COLL).updateOne(
      {
        _id: new ObjectId(id),
        userId: new ObjectId(session.user._id as string),
      },
      { $set: { status: 'archived', updatedAt: new Date() } },
    );
    revalidatePath(LIST_PATH);
    return { success: true };
  } catch (e) {
    console.error('[deleteKbCategory] failed:', e);
    return { success: false, error: 'Failed to delete category.' };
  }
}
