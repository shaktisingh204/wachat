'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import {
  hrList,
  hrGetById,
  hrSave,
  hrDelete,
  formToObject,
  requireSession,
  serialize,
} from '@/lib/hr-crud';
import type {
  WsDashboardWidget,
  WsDashboardWidgetType,
  WsUserTaskboardSetting,
  WsUserLeadboardSetting,
  WsPinnedItem,
  WsPinnedResourceType,
} from '@/lib/worksuite/dashboard-types';

/**
 * Worksuite Dashboard — server actions for user-specific dashboard
 * widgets, taskboard / leadboard view preferences, and pinned items.
 *
 * Collections:
 *   - crm_dashboard_widgets
 *   - crm_user_taskboard_settings
 *   - crm_user_leadboard_settings
 *   - crm_pinned_items
 *
 * All reads are tenant-scoped via hr-crud (userId = tenant). A second
 * viewer-scoped `user_id` is kept on every record for per-user state.
 */

type FormState = { message?: string; error?: string; id?: string };

const COLS = {
  widgets: 'crm_dashboard_widgets',
  taskboard: 'crm_user_taskboard_settings',
  leadboard: 'crm_user_leadboard_settings',
  pinned: 'crm_pinned_items',
} as const;

const PATHS = {
  widgets: '/dashboard/crm/settings/dashboard-widgets',
  taskboard: '/dashboard/crm/settings/taskboard-preferences',
  leadboard: '/dashboard/crm/settings/leadboard-preferences',
  pinned: '/dashboard/crm/pinned',
  crm: '/dashboard/crm',
} as const;

/* ─── Shared helpers ─────────────────────────────────────────── */

function asBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    return s === '1' || s === 'true' || s === 'yes' || s === 'on';
  }
  return false;
}

function toNumber(v: unknown, fallback = 0): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : fallback;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function toStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x)).filter(Boolean);
  if (typeof v === 'string' && v.trim()) {
    // JSON array?
    try {
      const p = JSON.parse(v);
      if (Array.isArray(p)) return p.map((x) => String(x)).filter(Boolean);
    } catch {
      /* fall through */
    }
    return v
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function clampWidth(n: number): number {
  if (!Number.isFinite(n)) return 12;
  return Math.max(1, Math.min(12, Math.round(n)));
}

/* ═══════════════════════════════════════════════════════════════════
 *  Dashboard Widgets
 * ══════════════════════════════════════════════════════════════════ */

export async function getMyDashboardWidgets(): Promise<WsDashboardWidget[]> {
  const user = await requireSession();
  if (!user) return [];
  const { db } = await connectToDatabase();
  const docs = await db
    .collection(COLS.widgets)
    .find({
      userId: new ObjectId(user._id),
      user_id: new ObjectId(user._id),
    })
    .sort({ position: 1, createdAt: 1 })
    .toArray();
  return serialize(docs) as WsDashboardWidget[];
}

export async function getDashboardWidgetById(id: string) {
  return hrGetById<WsDashboardWidget>(COLS.widgets, id);
}

export async function saveDashboardWidget(
  _prev: any,
  formData: FormData,
): Promise<FormState> {
  try {
    const user = await requireSession();
    if (!user) return { error: 'Access denied' };

    const raw = formToObject(formData, ['position', 'width']);
    const widget_name = String(raw.widget_name || '').trim();
    if (!widget_name) return { error: 'widget_name is required' };

    const type = (raw.type || 'stats') as WsDashboardWidgetType;
    const width = clampWidth(toNumber(raw.width, 12));
    const position = toNumber(raw.position, 0);
    const is_visible =
      raw.is_visible === undefined ? true : asBool(raw.is_visible);

    let config: Record<string, unknown> = {};
    if (typeof raw.config === 'string' && raw.config) {
      try {
        config = JSON.parse(raw.config);
      } catch {
        config = {};
      }
    } else if (raw.config && typeof raw.config === 'object') {
      config = raw.config as Record<string, unknown>;
    }

    const payload = {
      _id: raw._id,
      user_id: user._id, // coerced to ObjectId by hrSave via idFields
      widget_name,
      type,
      position,
      width,
      is_visible,
      config,
    };

    const res = await hrSave(COLS.widgets, payload, {
      idFields: ['user_id'],
    });
    if (res.error) return { error: res.error };
    revalidatePath(PATHS.widgets);
    revalidatePath(PATHS.crm);
    return { message: 'Saved successfully.', id: res.id };
  } catch (e: any) {
    return { error: e?.message || 'Failed to save widget' };
  }
}

export async function deleteDashboardWidget(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const r = await hrDelete(COLS.widgets, id);
  revalidatePath(PATHS.widgets);
  revalidatePath(PATHS.crm);
  return r;
}

export async function reorderDashboardWidgets(
  orderedIds: string[],
): Promise<{ success: boolean; error?: string }> {
  const user = await requireSession();
  if (!user) return { success: false, error: 'Access denied' };
  const { db } = await connectToDatabase();
  const ops = orderedIds
    .filter((id) => ObjectId.isValid(id))
    .map((id, idx) => ({
      updateOne: {
        filter: {
          _id: new ObjectId(id),
          userId: new ObjectId(user._id),
          user_id: new ObjectId(user._id),
        },
        update: { $set: { position: idx, updatedAt: new Date() } },
      },
    }));
  if (ops.length) await db.collection(COLS.widgets).bulkWrite(ops);
  revalidatePath(PATHS.widgets);
  revalidatePath(PATHS.crm);
  return { success: true };
}

export async function toggleWidgetVisibility(
  id: string,
): Promise<{ success: boolean; is_visible?: boolean; error?: string }> {
  const user = await requireSession();
  if (!user) return { success: false, error: 'Access denied' };
  if (!ObjectId.isValid(id))
    return { success: false, error: 'Invalid widget id' };
  const { db } = await connectToDatabase();
  const filter = {
    _id: new ObjectId(id),
    userId: new ObjectId(user._id),
    user_id: new ObjectId(user._id),
  };
  const existing = await db.collection(COLS.widgets).findOne(filter);
  if (!existing) return { success: false, error: 'Widget not found' };
  const next = !existing.is_visible;
  await db
    .collection(COLS.widgets)
    .updateOne(filter, { $set: { is_visible: next, updatedAt: new Date() } });
  revalidatePath(PATHS.widgets);
  revalidatePath(PATHS.crm);
  return { success: true, is_visible: next };
}

/* ═══════════════════════════════════════════════════════════════════
 *  User Taskboard Settings
 * ══════════════════════════════════════════════════════════════════ */

export async function getMyTaskboardSettings(): Promise<
  WsUserTaskboardSetting[]
> {
  const user = await requireSession();
  if (!user) return [];
  const { db } = await connectToDatabase();
  const docs = await db
    .collection(COLS.taskboard)
    .find({
      userId: new ObjectId(user._id),
      user_id: new ObjectId(user._id),
    })
    .sort({ createdAt: -1 })
    .toArray();
  return serialize(docs) as WsUserTaskboardSetting[];
}

export async function getTaskboardSettingsForProject(
  projectId: string | null,
): Promise<WsUserTaskboardSetting | null> {
  const user = await requireSession();
  if (!user) return null;
  const { db } = await connectToDatabase();
  const filter: Record<string, unknown> = {
    userId: new ObjectId(user._id),
    user_id: new ObjectId(user._id),
  };
  if (projectId && ObjectId.isValid(projectId)) {
    filter.project_id = new ObjectId(projectId);
  } else {
    filter.project_id = null;
  }
  const doc = await db.collection(COLS.taskboard).findOne(filter);
  return doc ? (serialize(doc) as WsUserTaskboardSetting) : null;
}

export async function saveTaskboardSettings(
  userId: string | null,
  projectId: string | null,
  settings: Partial<WsUserTaskboardSetting>,
): Promise<{ success: boolean; id?: string; error?: string }> {
  // Note: `userId` param is accepted for API parity with the spec but we
  // always resolve it from the session for safety.
  void userId;
  const user = await requireSession();
  if (!user) return { success: false, error: 'Access denied' };
  const { db } = await connectToDatabase();

  const projOid =
    projectId && ObjectId.isValid(projectId) ? new ObjectId(projectId) : null;

  const now = new Date();
  const $set: Record<string, unknown> = {
    userId: new ObjectId(user._id),
    user_id: new ObjectId(user._id),
    project_id: projOid,
    hide_done: asBool(settings.hide_done),
    group_by: (settings.group_by || 'none') as string,
    sort_by: (settings.sort_by || 'due_date') as string,
    visible_columns: toStringArray(settings.visible_columns),
    updatedAt: now,
  };

  const filter = {
    userId: new ObjectId(user._id),
    user_id: new ObjectId(user._id),
    project_id: projOid,
  };
  const res = await db.collection(COLS.taskboard).findOneAndUpdate(
    filter,
    { $set, $setOnInsert: { createdAt: now } },
    { upsert: true, returnDocument: 'after' },
  );
  revalidatePath(PATHS.taskboard);
  const id =
    (res && (res as any).value?._id?.toString?.()) ||
    (res as any)?._id?.toString?.();
  return { success: true, id };
}

export async function deleteTaskboardSettings(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const r = await hrDelete(COLS.taskboard, id);
  revalidatePath(PATHS.taskboard);
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
 *  User Leadboard Settings
 * ══════════════════════════════════════════════════════════════════ */

export async function getMyLeadboardSettings(): Promise<
  WsUserLeadboardSetting[]
> {
  const user = await requireSession();
  if (!user) return [];
  const { db } = await connectToDatabase();
  const docs = await db
    .collection(COLS.leadboard)
    .find({
      userId: new ObjectId(user._id),
      user_id: new ObjectId(user._id),
    })
    .sort({ createdAt: -1 })
    .toArray();
  return serialize(docs) as WsUserLeadboardSetting[];
}

export async function getLeadboardSettingsForPipeline(
  pipelineId: string,
): Promise<WsUserLeadboardSetting | null> {
  const user = await requireSession();
  if (!user || !ObjectId.isValid(pipelineId)) return null;
  const { db } = await connectToDatabase();
  const doc = await db.collection(COLS.leadboard).findOne({
    userId: new ObjectId(user._id),
    user_id: new ObjectId(user._id),
    pipeline_id: new ObjectId(pipelineId),
  });
  return doc ? (serialize(doc) as WsUserLeadboardSetting) : null;
}

export async function saveLeadboardSettings(
  userId: string | null,
  pipelineId: string,
  settings: Partial<WsUserLeadboardSetting>,
): Promise<{ success: boolean; id?: string; error?: string }> {
  void userId;
  const user = await requireSession();
  if (!user) return { success: false, error: 'Access denied' };
  if (!pipelineId || !ObjectId.isValid(pipelineId)) {
    return { success: false, error: 'Invalid pipeline id' };
  }
  const { db } = await connectToDatabase();

  const now = new Date();
  const $set: Record<string, unknown> = {
    userId: new ObjectId(user._id),
    user_id: new ObjectId(user._id),
    pipeline_id: new ObjectId(pipelineId),
    hide_stages: toStringArray(settings.hide_stages),
    sort_by: (settings.sort_by || 'stage') as string,
    visible_columns: toStringArray(settings.visible_columns),
    updatedAt: now,
  };

  const filter = {
    userId: new ObjectId(user._id),
    user_id: new ObjectId(user._id),
    pipeline_id: new ObjectId(pipelineId),
  };
  const res = await db.collection(COLS.leadboard).findOneAndUpdate(
    filter,
    { $set, $setOnInsert: { createdAt: now } },
    { upsert: true, returnDocument: 'after' },
  );
  revalidatePath(PATHS.leadboard);
  const id =
    (res && (res as any).value?._id?.toString?.()) ||
    (res as any)?._id?.toString?.();
  return { success: true, id };
}

export async function deleteLeadboardSettings(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const r = await hrDelete(COLS.leadboard, id);
  revalidatePath(PATHS.leadboard);
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Pinned items
 * ══════════════════════════════════════════════════════════════════ */

const VALID_PIN_TYPES: WsPinnedResourceType[] = [
  'project',
  'task',
  'lead',
  'deal',
  'ticket',
  'kb',
  'note',
];

export async function getMyPinnedItems(): Promise<WsPinnedItem[]> {
  const user = await requireSession();
  if (!user) return [];
  const { db } = await connectToDatabase();
  const docs = await db
    .collection(COLS.pinned)
    .find({
      userId: new ObjectId(user._id),
      user_id: new ObjectId(user._id),
    })
    .sort({ pinned_at: -1 })
    .toArray();
  return serialize(docs) as WsPinnedItem[];
}

export async function pinItem(
  resourceType: WsPinnedResourceType,
  resourceId: string,
  title?: string,
): Promise<{ success: boolean; id?: string; error?: string }> {
  const user = await requireSession();
  if (!user) return { success: false, error: 'Access denied' };
  if (!VALID_PIN_TYPES.includes(resourceType)) {
    return { success: false, error: 'Invalid resource type' };
  }
  if (!resourceId) return { success: false, error: 'Missing resource id' };

  const { db } = await connectToDatabase();
  const rid = ObjectId.isValid(resourceId)
    ? new ObjectId(resourceId)
    : resourceId;
  const now = new Date();

  const filter = {
    userId: new ObjectId(user._id),
    user_id: new ObjectId(user._id),
    resource_type: resourceType,
    resource_id: rid,
  };

  const existing = await db.collection(COLS.pinned).findOne(filter);
  if (existing) {
    revalidatePath(PATHS.pinned);
    revalidatePath(PATHS.crm);
    return { success: true, id: existing._id.toString() };
  }

  const res = await db.collection(COLS.pinned).insertOne({
    ...filter,
    title: title || '',
    pinned_at: now,
    createdAt: now,
    updatedAt: now,
  });
  revalidatePath(PATHS.pinned);
  revalidatePath(PATHS.crm);
  return { success: true, id: res.insertedId.toString() };
}

export async function unpinItem(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const r = await hrDelete(COLS.pinned, id);
  revalidatePath(PATHS.pinned);
  revalidatePath(PATHS.crm);
  return r;
}

export async function unpinByResource(
  resourceType: WsPinnedResourceType,
  resourceId: string,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireSession();
  if (!user) return { success: false, error: 'Access denied' };
  const { db } = await connectToDatabase();
  const rid = ObjectId.isValid(resourceId)
    ? new ObjectId(resourceId)
    : resourceId;
  await db.collection(COLS.pinned).deleteOne({
    userId: new ObjectId(user._id),
    user_id: new ObjectId(user._id),
    resource_type: resourceType,
    resource_id: rid,
  });
  revalidatePath(PATHS.pinned);
  revalidatePath(PATHS.crm);
  return { success: true };
}

/* Re-exports so pages can import List-shaped helpers directly. */
export { hrList as _hrListPassthrough };

/* Used by the main CRM dashboard for the "Pinned" quick card. */
export async function getPinnedQuickList(
  limit = 6,
): Promise<WsPinnedItem[]> {
  const all = await getMyPinnedItems();
  return all.slice(0, Math.max(0, limit));
}

/* Simple getters for edit forms / lookups. */
export async function getPinnedById(id: string) {
  return hrGetById<WsPinnedItem>(COLS.pinned, id);
}

export async function listDashboardWidgets() {
  return hrList<WsDashboardWidget>(COLS.widgets, { sortBy: { position: 1 } });
}
