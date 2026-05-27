'use server';

/**
 * CRM Saved Views server actions (CRM_REBUILD_PLAN §5.10).
 *
 * Persists per-list-page filter+columns+sort configs. Each view is
 * scoped to a tenant (`userId`) and an entity key (e.g. `"invoices"`).
 * A user can mark one view per (userId, entityKey) as the default.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId, type Filter, type Document, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { writeAuditEntry } from '@/lib/audit-log';
import { requirePermission } from '@/lib/rbac-server';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { crmSavedViewsApi } from '@/lib/rust-client/crm-saved-views';
import { RustApiError } from '@/lib/rust-client/fetcher';
import type { CrmSavedView, CrmSavedViewScope } from '@/lib/definitions';

const COL = 'crm_saved_views';

function jsonClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function useRustCrm(): boolean {
  return process.env.USE_RUST_CRM === 'true';
}

/* ─── Read ─────────────────────────────────────────────────────── */

interface ListSavedViewsParams {
  entityKey: string;
  /** When omitted, returns both private (owned) and team views. */
  includeTeam?: boolean;
}

export async function listSavedViews(
  params: ListSavedViewsParams,
): Promise<{ views: WithId<CrmSavedView>[]; error?: string }> {
  const session = await getSession();
  if (!session?.user) return { views: [], error: 'Unauthorized' };

  const guard = await requirePermission('crm_saved_view', 'view');
  if (!guard.ok) return { views: [], error: guard.error };

  try {
    const { db } = await connectToDatabase();
    const userObjectId = new ObjectId(session.user._id);

    const includeTeam = params.includeTeam !== false;
    const baseFilter: Filter<Document> = {
      userId: userObjectId,
      entityKey: params.entityKey,
      archived: { $ne: true },
    };
    const filter: Filter<Document> = includeTeam
      ? baseFilter
      : { ...baseFilter, ownerId: userObjectId };

    const cursor = db
      .collection<CrmSavedView>(COL)
      .find(filter)
      .sort({ isDefault: -1, name: 1 });
    const rows = await cursor.toArray();
    return { views: jsonClone(rows) };
  } catch (e: any) {
    console.error('[listSavedViews] failed:', e);
    return { views: [], error: e?.message ?? 'Failed to load saved views.' };
  }
}

export async function getSavedViewById(
  viewId: string,
): Promise<WithId<CrmSavedView> | null> {
  const session = await getSession();
  if (!session?.user) return null;
  if (!ObjectId.isValid(viewId)) return null;

  if (useRustCrm()) {
    try {
      const doc = await crmSavedViewsApi.getById(viewId);
      return jsonClone(doc) as unknown as WithId<CrmSavedView>;
    } catch (e) {
      console.error('[getSavedViewById] rust path failed; falling back:', e);
      recordRustFallback({
        entity: 'saved_view',
        op: 'get',
        errorCode: e instanceof RustApiError ? e.code : undefined,
        status: e instanceof RustApiError ? e.status : undefined,
      });
    }
  }

  try {
    const { db } = await connectToDatabase();
    const doc = await db.collection<CrmSavedView>(COL).findOne({
      _id: new ObjectId(viewId),
      userId: new ObjectId(session.user._id),
    });
    return doc ? jsonClone(doc) : null;
  } catch (e) {
    console.error('[getSavedViewById] failed:', e);
    return null;
  }
}

/* ─── Write ────────────────────────────────────────────────────── */

interface SaveSavedViewInput {
  /** Pass an existing id to update; omit to create. */
  id?: string;
  entityKey: string;
  name: string;
  scope?: CrmSavedViewScope;
  filters?: Record<string, unknown>;
  columns?: string[];
  sort?: Array<[string, '+' | '-']>;
  density?: 'comfortable' | 'compact' | 'dense';
  isDefault?: boolean;
}

export async function saveSavedView(
  input: SaveSavedViewInput,
): Promise<{ success: boolean; id?: string; error?: string }> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Unauthorized' };

  const isEditing = !!input.id && ObjectId.isValid(input.id);
  const guard = await requirePermission(
    'crm_saved_view',
    isEditing ? 'edit' : 'create',
  );
  if (!guard.ok) return { success: false, error: guard.error };

  const name = input.name.trim();
  if (!name) return { success: false, error: 'Name is required.' };
  if (!input.entityKey?.trim()) {
    return { success: false, error: 'entityKey is required.' };
  }

  try {
    const { db } = await connectToDatabase();
    const userObjectId = new ObjectId(session.user._id);

    const $set: Record<string, unknown> = {
      entityKey: input.entityKey,
      name,
      scope: input.scope ?? 'private',
      filters: input.filters ?? {},
      columns: input.columns ?? [],
      sort: input.sort ?? [],
      density: input.density ?? 'comfortable',
      updatedAt: new Date(),
    };

    let viewObjectId: ObjectId;
    if (isEditing) {
      viewObjectId = new ObjectId(input.id);
      const result = await db.collection(COL).updateOne(
        { _id: viewObjectId, userId: userObjectId },
        { $set },
      );
      if (result.matchedCount === 0) {
        return { success: false, error: 'Saved view not found.' };
      }
    } else {
      const doc = {
        userId: userObjectId,
        ownerId: userObjectId,
        archived: false,
        isDefault: false,
        createdAt: new Date(),
        ...$set,
      };
      const inserted = await db.collection(COL).insertOne(doc);
      viewObjectId = inserted.insertedId;
    }

    if (input.isDefault) {
      // Unset isDefault on every other view for this (user, entityKey).
      await db.collection(COL).updateMany(
        {
          userId: userObjectId,
          entityKey: input.entityKey,
          _id: { $ne: viewObjectId },
        },
        { $set: { isDefault: false } },
      );
      await db
        .collection(COL)
        .updateOne(
          { _id: viewObjectId, userId: userObjectId },
          { $set: { isDefault: true, updatedAt: new Date() } },
        );
    }

    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: isEditing ? 'update' : 'create',
        entityKind: 'saved_view',
        entityId: viewObjectId.toString(),
        reason: `${input.entityKey} → ${name}`,
      });
    } catch {
      /* non-fatal */
    }

    revalidatePath('/dashboard/crm');
    return { success: true, id: viewObjectId.toString() };
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Failed to save view.' };
  }
}

export async function setSavedViewAsDefault(
  viewId: string,
): Promise<{ success: boolean; error?: string }> {
  if (!ObjectId.isValid(viewId))
    return { success: false, error: 'Invalid id.' };
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Unauthorized' };
  const guard = await requirePermission('crm_saved_view', 'edit');
  if (!guard.ok) return { success: false, error: guard.error };

  try {
    const { db } = await connectToDatabase();
    const userObjectId = new ObjectId(session.user._id);
    const oid = new ObjectId(viewId);
    const view = await db
      .collection<CrmSavedView>(COL)
      .findOne({ _id: oid, userId: userObjectId });
    if (!view) return { success: false, error: 'Saved view not found.' };

    await db.collection(COL).updateMany(
      {
        userId: userObjectId,
        entityKey: view.entityKey,
        _id: { $ne: oid },
      },
      { $set: { isDefault: false } },
    );
    await db
      .collection(COL)
      .updateOne(
        { _id: oid, userId: userObjectId },
        { $set: { isDefault: true, updatedAt: new Date() } },
      );

    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: 'status_change',
        entityKind: 'saved_view',
        entityId: viewId,
        diff: { isDefault: { after: true } },
      });
    } catch {
      /* non-fatal */
    }
    revalidatePath('/dashboard/crm');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Failed.' };
  }
}

export async function deleteSavedView(
  viewId: string,
): Promise<{ success: boolean; error?: string }> {
  if (!ObjectId.isValid(viewId))
    return { success: false, error: 'Invalid id.' };
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Unauthorized' };
  const guard = await requirePermission('crm_saved_view', 'delete');
  if (!guard.ok) return { success: false, error: guard.error };

  try {
    const { db } = await connectToDatabase();
    const userObjectId = new ObjectId(session.user._id);
    const result = await db.collection(COL).deleteOne({
      _id: new ObjectId(viewId),
      userId: userObjectId,
    });
    if (result.deletedCount === 0) {
      return { success: false, error: 'Saved view not found.' };
    }

    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: 'delete',
        entityKind: 'saved_view',
        entityId: viewId,
      });
    } catch {
      /* non-fatal */
    }
    revalidatePath('/dashboard/crm');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Failed.' };
  }
}

/**
 * Server-side helper: return the saved view marked default for
 * `(session user, entityKey)`. Used by list pages to hydrate their
 * default filter set on initial render.
 */
export async function getDefaultSavedView(
  entityKey: string,
): Promise<WithId<CrmSavedView> | null> {
  const session = await getSession();
  if (!session?.user) return null;

  try {
    const { db } = await connectToDatabase();
    const userObjectId = new ObjectId(session.user._id);
    const doc = await db.collection<CrmSavedView>(COL).findOne({
      userId: userObjectId,
      entityKey,
      isDefault: true,
      archived: { $ne: true },
    });
    return doc ? jsonClone(doc) : null;
  } catch (e) {
    console.error('[getDefaultSavedView] failed:', e);
    return null;
  }
}

/* ─── §5.10 spec-aligned wrappers ──────────────────────────────────────
 *
 * These names match CRM_REBUILD_PLAN §5.10 verbatim. They delegate to the
 * existing implementations above; new call sites should prefer these.
 */

import type { SavedView, SavedViewScope, SavedViewSortDir } from '@/lib/saved-views/types';

function toSavedViewShape(row: WithId<CrmSavedView>): SavedView {
  const r = row as unknown as {
    _id: unknown;
    userId?: unknown;
    ownerId?: unknown;
    name?: string;
    entityKey?: string;
    scope?: string;
    filters?: Record<string, unknown>;
    columns?: string[];
    visibleColumns?: string[];
    sort?: Array<[string, '+' | '-']>;
    sortBy?: string | null;
    sortDir?: SavedViewSortDir | null;
    isDefault?: boolean;
    createdAt?: Date | string;
    updatedAt?: Date | string;
  };
  let sortBy: string | undefined = r.sortBy ?? undefined;
  let sortDir: SavedViewSortDir | undefined = r.sortDir ?? undefined;
  if (!sortBy && Array.isArray(r.sort) && r.sort.length > 0) {
    const head = r.sort[0];
    if (Array.isArray(head) && typeof head[0] === 'string') {
      sortBy = head[0];
      sortDir = head[1] === '-' ? 'desc' : 'asc';
    }
  }
  const visibleColumns =
    (Array.isArray(r.visibleColumns) && r.visibleColumns) ||
    (Array.isArray(r.columns) && r.columns) ||
    [];
  return {
    _id: String(r._id),
    ownerId: String(r.ownerId ?? r.userId ?? ''),
    name: r.name ?? '',
    entityKind: r.entityKey ?? '',
    // Legacy DB rows use 'team' for the shared scope; §5.10 uses 'shared'.
    scope: r.scope === 'shared' || r.scope === 'team' ? 'shared' : 'private',
    filters: r.filters ?? {},
    visibleColumns,
    sortBy,
    sortDir,
    isDefault: !!r.isDefault,
    createdAt:
      r.createdAt instanceof Date
        ? r.createdAt.toISOString()
        : typeof r.createdAt === 'string'
          ? r.createdAt
          : new Date().toISOString(),
    updatedAt:
      r.updatedAt instanceof Date
        ? r.updatedAt.toISOString()
        : typeof r.updatedAt === 'string'
          ? r.updatedAt
          : new Date().toISOString(),
  };
}

/** Returns views the current user owns + tenant-shared views. (§5.10) */
export async function getSavedViews(entityKind: string): Promise<SavedView[]> {
  if (!entityKind) return [];
  const { views } = await listSavedViews({ entityKey: entityKind, includeTeam: true });
  return views.map(toSavedViewShape);
}

function parseJsonRecord(
  raw: FormDataEntryValue | null,
  fallback: Record<string, unknown>,
): Record<string, unknown> {
  if (typeof raw !== 'string' || !raw.trim()) return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* fall through */
  }
  return fallback;
}

function parseJsonStringArray(
  raw: FormDataEntryValue | null,
  fallback: string[],
): string[] {
  if (typeof raw !== 'string' || !raw.trim()) return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((v): v is string => typeof v === 'string');
    }
  } catch {
    /* fall through */
  }
  return fallback;
}

/**
 * §5.10 spec-named saveSavedView — FormData form.
 *
 * Accepts: `viewId?`, `name`, `entityKind`, `scope`, `filters` (JSON),
 * `visibleColumns` (JSON), `sortBy?`, `sortDir?`, `isDefault`.
 */
export async function saveSavedViewFromForm(
  _prev: { error?: string; message?: string; view?: SavedView } | undefined,
  formData: FormData,
): Promise<{ error?: string; message?: string; view?: SavedView }> {
  const viewId = (formData.get('viewId') as string | null) ?? undefined;
  const name = ((formData.get('name') as string | null) ?? '').trim();
  const entityKind = ((formData.get('entityKind') as string | null) ?? '').trim();
  const scopeRaw = ((formData.get('scope') as string | null) ?? 'private').trim();
  const scope: SavedViewScope = scopeRaw === 'shared' ? 'shared' : 'private';
  const filters = parseJsonRecord(formData.get('filters'), {});
  const visibleColumns = parseJsonStringArray(formData.get('visibleColumns'), []);
  const sortBy = ((formData.get('sortBy') as string | null) ?? '').trim() || undefined;
  const sortDirRaw = ((formData.get('sortDir') as string | null) ?? '').trim();
  const sortDir: SavedViewSortDir | undefined =
    sortDirRaw === 'asc' || sortDirRaw === 'desc' ? sortDirRaw : undefined;
  const isDefault = (formData.get('isDefault') as string | null) === 'true';

  if (!name) return { error: 'A view name is required.' };
  if (!entityKind) return { error: 'entityKind is required.' };

  const sortTuple: Array<[string, '+' | '-']> = sortBy
    ? [[sortBy, sortDir === 'desc' ? '-' : '+']]
    : [];

  // Bridge from the §5.10 scope ('shared') to the legacy DB scope ('team').
  const legacyScope: CrmSavedViewScope = scope === 'shared' ? 'team' : 'private';
  const res = await saveSavedView({
    id: viewId && viewId.trim() ? viewId : undefined,
    entityKey: entityKind,
    name,
    scope: legacyScope,
    filters,
    columns: visibleColumns,
    sort: sortTuple,
    isDefault,
  });
  if (!res.success) return { error: res.error ?? 'Save failed.' };
  if (!res.id) return { message: 'Saved.' };
  const row = await getSavedViewById(res.id);
  return {
    message: 'View saved.',
    view: row ? toSavedViewShape(row) : undefined,
  };
}

/**
 * §5.10 spec-named: flip a view to default for `(userId, entityKind)`.
 * Thin wrapper around `setSavedViewAsDefault` that also validates the
 * (entityKind, viewId) tuple — keeps the public surface aligned with the
 * plan even though the underlying impl only needs the id.
 */
export async function setDefaultSavedView(
  entityKind: string,
  viewId: string,
): Promise<{ success: boolean; error?: string }> {
  if (!entityKind) return { success: false, error: 'entityKind is required.' };
  if (!viewId || !ObjectId.isValid(viewId)) {
    return { success: false, error: 'Invalid view id.' };
  }
  const view = await getSavedViewById(viewId);
  if (!view) return { success: false, error: 'Saved view not found.' };
  const viewEntityKind = (view as unknown as { entityKey?: string }).entityKey;
  if (viewEntityKind && viewEntityKind !== entityKind) {
    return { success: false, error: 'View does not belong to this list.' };
  }
  return setSavedViewAsDefault(viewId);
}
