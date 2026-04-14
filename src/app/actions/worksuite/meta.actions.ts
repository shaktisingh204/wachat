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
  WsCustomField,
  WsCustomFieldGroup,
  WsCustomFieldValue,
  WsCustomFieldBelongsTo,
  WsCustomLinkSetting,
  WsTax,
  WsUnitType,
  WsPromotionExt,
  WsExpenseCategoryExt,
  WsFlag,
  WsSavedSearch,
} from '@/lib/worksuite/meta-types';

/**
 * Worksuite Meta — server actions for the miscellaneous meta modules
 * (custom fields/groups/values, custom sidebar links, tax, unit types,
 * promotions-ext, expense categories, resource flags, universal search).
 *
 * Collections: crm_custom_fields, crm_custom_field_groups,
 *              crm_custom_field_values, crm_custom_links, crm_taxes,
 *              crm_unit_types, crm_promotions_ext, crm_issues (re-used),
 *              crm_taskboard_columns (re-used),
 *              crm_expense_categories_ext, crm_flags, crm_saved_searches.
 */

type FormState = { message?: string; error?: string; id?: string };

const COLS = {
  fieldGroup: 'crm_custom_field_groups',
  field: 'crm_custom_fields',
  fieldValue: 'crm_custom_field_values',
  customLink: 'crm_custom_links',
  tax: 'crm_taxes',
  unit: 'crm_unit_types',
  promoExt: 'crm_promotions_ext',
  expenseCategoryExt: 'crm_expense_categories_ext',
  flag: 'crm_flags',
  savedSearch: 'crm_saved_searches',
} as const;

/* ─── Shared helpers ───────────────────────────────────────────── */

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

function slugify(input: string): string {
  return String(input)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

async function genericSave(
  collection: string,
  revalidate: string,
  formData: FormData,
  options: {
    idFields?: string[];
    dateFields?: string[];
    numericKeys?: string[];
    boolKeys?: string[];
    jsonKeys?: string[];
  } = {},
): Promise<FormState> {
  try {
    const data = formToObject(formData, options.numericKeys || []);
    for (const k of options.boolKeys || []) {
      data[k] = asBool(data[k]);
    }
    for (const k of options.jsonKeys || []) {
      if (typeof data[k] === 'string' && data[k]) {
        try {
          data[k] = JSON.parse(data[k]);
        } catch {
          /* leave string */
        }
      }
    }
    const res = await hrSave(collection, data, {
      idFields: options.idFields,
      dateFields: options.dateFields,
    });
    if (res.error) return { error: res.error };
    revalidatePath(revalidate);
    return { message: 'Saved successfully.', id: res.id };
  } catch (e: any) {
    return { error: e?.message || 'Failed to save' };
  }
}

/* ═══════════════════════════════════════════════════════════════════
 *  Custom Field Groups
 * ══════════════════════════════════════════════════════════════════ */

export async function getCustomFieldGroups() {
  return hrList<WsCustomFieldGroup>(COLS.fieldGroup, { sortBy: { name: 1 } });
}

export async function getCustomFieldGroupById(id: string) {
  return hrGetById<WsCustomFieldGroup>(COLS.fieldGroup, id);
}

export async function saveCustomFieldGroup(_prev: any, formData: FormData) {
  return genericSave(
    COLS.fieldGroup,
    '/dashboard/crm/settings/custom-fields/groups',
    formData,
  );
}

export async function deleteCustomFieldGroup(id: string) {
  const r = await hrDelete(COLS.fieldGroup, id);
  revalidatePath('/dashboard/crm/settings/custom-fields/groups');
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Custom Fields
 * ══════════════════════════════════════════════════════════════════ */

export async function getCustomFields() {
  return hrList<WsCustomField>(COLS.field, { sortBy: { position: 1 } });
}

export async function getCustomFieldById(id: string) {
  return hrGetById<WsCustomField>(COLS.field, id);
}

export async function getCustomFieldsFor(entityType: WsCustomFieldBelongsTo) {
  const user = await requireSession();
  if (!user) return [];
  const { db } = await connectToDatabase();
  const docs = await db
    .collection(COLS.field)
    .find({
      userId: new ObjectId(user._id),
      belongs_to: entityType,
    })
    .sort({ position: 1 })
    .toArray();
  return serialize(docs) as any[];
}

export async function saveCustomField(_prev: any, formData: FormData) {
  try {
    const raw = formToObject(formData, ['position']);
    raw.is_required = asBool(raw.is_required);
    raw.display_in_table = asBool(raw.display_in_table);

    // values: comma-delimited string → array
    if (typeof raw.values === 'string') {
      raw.values = raw.values
        .split(/[\n,]/)
        .map((v: string) => v.trim())
        .filter(Boolean);
    }

    // ensure a slug
    if (!raw.name && raw.label) raw.name = slugify(raw.label);
    else if (raw.name) raw.name = slugify(raw.name);

    // Denormalise belongs_to from the chosen group, if missing
    if (!raw.belongs_to && raw.group_id && typeof raw.group_id === 'string') {
      try {
        const grp = await hrGetById<WsCustomFieldGroup>(
          COLS.fieldGroup,
          raw.group_id,
        );
        if (grp?.belongs_to) raw.belongs_to = grp.belongs_to;
      } catch {
        /* ignore */
      }
    }

    const res = await hrSave(COLS.field, raw, {
      idFields: ['group_id'],
    });
    if (res.error) return { error: res.error };
    revalidatePath('/dashboard/crm/settings/custom-fields');
    return { message: 'Saved successfully.', id: res.id };
  } catch (e: any) {
    return { error: e?.message || 'Failed to save' };
  }
}

export async function deleteCustomField(id: string) {
  const r = await hrDelete(COLS.field, id);
  revalidatePath('/dashboard/crm/settings/custom-fields');
  return r;
}

/**
 * Bulk reorder fields within a group — accepts an ordered array of
 * field ids and writes their positions atomically.
 */
export async function reorderCustomFields(
  groupId: string,
  orderedIds: string[],
): Promise<{ success: boolean; error?: string }> {
  const user = await requireSession();
  if (!user) return { success: false, error: 'Access denied' };
  if (!ObjectId.isValid(groupId)) return { success: false, error: 'Invalid group' };
  const { db } = await connectToDatabase();
  const ops = orderedIds
    .filter((id) => ObjectId.isValid(id))
    .map((id, idx) => ({
      updateOne: {
        filter: {
          _id: new ObjectId(id),
          userId: new ObjectId(user._id),
          group_id: new ObjectId(groupId),
        },
        update: { $set: { position: idx, updatedAt: new Date() } },
      },
    }));
  if (ops.length) await db.collection(COLS.field).bulkWrite(ops);
  revalidatePath('/dashboard/crm/settings/custom-fields');
  return { success: true };
}

/* ═══════════════════════════════════════════════════════════════════
 *  Custom Field Values (per-entity storage)
 * ══════════════════════════════════════════════════════════════════ */

export async function getCustomFieldValues(
  entityType: WsCustomFieldBelongsTo,
  entityId: string,
): Promise<WsCustomFieldValue | null> {
  const user = await requireSession();
  if (!user) return null;
  if (!ObjectId.isValid(entityId)) return null;
  const { db } = await connectToDatabase();
  const doc = await db.collection(COLS.fieldValue).findOne({
    userId: new ObjectId(user._id),
    entity_type: entityType,
    entity_id: new ObjectId(entityId),
  });
  return doc ? (serialize(doc) as WsCustomFieldValue) : null;
}

/**
 * Apply / overwrite the custom-field value set for a given entity.
 * Upserts the document keyed by `(userId, entity_type, entity_id)`.
 */
export async function applyCustomFieldsToEntity(
  entityType: WsCustomFieldBelongsTo,
  entityId: string,
  values: Record<string, unknown>,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireSession();
  if (!user) return { success: false, error: 'Access denied' };
  if (!ObjectId.isValid(entityId)) return { success: false, error: 'Invalid entity id' };
  const { db } = await connectToDatabase();
  const now = new Date();
  await db.collection(COLS.fieldValue).updateOne(
    {
      userId: new ObjectId(user._id),
      entity_type: entityType,
      entity_id: new ObjectId(entityId),
    },
    {
      $set: {
        userId: new ObjectId(user._id),
        entity_type: entityType,
        entity_id: new ObjectId(entityId),
        values: values || {},
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );
  return { success: true };
}

/* ═══════════════════════════════════════════════════════════════════
 *  Custom Link Settings
 * ══════════════════════════════════════════════════════════════════ */

export async function getCustomLinks() {
  return hrList<WsCustomLinkSetting>(COLS.customLink, { sortBy: { position: 1 } });
}

export async function saveCustomLink(_prev: any, formData: FormData) {
  return genericSave(
    COLS.customLink,
    '/dashboard/crm/settings/custom-links',
    formData,
    { numericKeys: ['position'], boolKeys: ['open_in_new_tab'] },
  );
}

export async function deleteCustomLink(id: string) {
  const r = await hrDelete(COLS.customLink, id);
  revalidatePath('/dashboard/crm/settings/custom-links');
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Taxes
 * ══════════════════════════════════════════════════════════════════ */

export async function getTaxes() {
  return hrList<WsTax>(COLS.tax, { sortBy: { tax_name: 1 } });
}

export async function saveTax(_prev: any, formData: FormData) {
  return genericSave(COLS.tax, '/dashboard/crm/settings/taxes', formData, {
    numericKeys: ['rate_percent'],
    boolKeys: ['is_default'],
  });
}

export async function deleteTax(id: string) {
  const r = await hrDelete(COLS.tax, id);
  revalidatePath('/dashboard/crm/settings/taxes');
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Unit Types
 * ══════════════════════════════════════════════════════════════════ */

export async function getUnitTypes() {
  return hrList<WsUnitType>(COLS.unit, { sortBy: { unit_name: 1 } });
}

export async function saveUnitType(_prev: any, formData: FormData) {
  return genericSave(
    COLS.unit,
    '/dashboard/crm/settings/unit-types',
    formData,
  );
}

export async function deleteUnitType(id: string) {
  const r = await hrDelete(COLS.unit, id);
  revalidatePath('/dashboard/crm/settings/unit-types');
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Promotions — extended lightweight code table.
 *  (Separate from the storefront `crm_promotions` in billing.actions.)
 * ══════════════════════════════════════════════════════════════════ */

export async function getPromotionsExt() {
  return hrList<WsPromotionExt>(COLS.promoExt, { sortBy: { name: 1 } });
}

export async function savePromotionExt(_prev: any, formData: FormData) {
  return genericSave(
    COLS.promoExt,
    '/dashboard/crm/settings/promotions',
    formData,
    {
      numericKeys: ['value', 'usage_limit'],
      dateFields: ['start_date', 'end_date'],
    },
  );
}

export async function deletePromotionExt(id: string) {
  const r = await hrDelete(COLS.promoExt, id);
  revalidatePath('/dashboard/crm/settings/promotions');
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Expense Categories (extended)
 * ══════════════════════════════════════════════════════════════════ */

export async function getExpenseCategoriesExt() {
  return hrList<WsExpenseCategoryExt>(COLS.expenseCategoryExt, {
    sortBy: { category_name: 1 },
  });
}

export async function saveExpenseCategoryExt(_prev: any, formData: FormData) {
  return genericSave(
    COLS.expenseCategoryExt,
    '/dashboard/crm/settings/expense-categories',
    formData,
  );
}

export async function deleteExpenseCategoryExt(id: string) {
  const r = await hrDelete(COLS.expenseCategoryExt, id);
  revalidatePath('/dashboard/crm/settings/expense-categories');
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Flags
 * ══════════════════════════════════════════════════════════════════ */

export async function getFlags() {
  return hrList<WsFlag>(COLS.flag, { sortBy: { createdAt: -1 } });
}

export async function saveFlag(_prev: any, formData: FormData) {
  return genericSave(COLS.flag, '/dashboard/crm/settings/flags', formData, {
    idFields: ['resource_id'],
  });
}

export async function deleteFlag(id: string) {
  const r = await hrDelete(COLS.flag, id);
  revalidatePath('/dashboard/crm/settings/flags');
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Universal Search — persisted saved searches (skeleton)
 * ══════════════════════════════════════════════════════════════════ */

export async function getSavedSearches() {
  return hrList<WsSavedSearch>(COLS.savedSearch, {
    sortBy: { last_used_at: -1 },
  });
}

export async function saveSavedSearch(_prev: any, formData: FormData) {
  return genericSave(
    COLS.savedSearch,
    '/dashboard/crm/settings/saved-searches',
    formData,
    {
      numericKeys: ['result_count'],
      dateFields: ['last_used_at'],
    },
  );
}

export async function deleteSavedSearch(id: string) {
  const r = await hrDelete(COLS.savedSearch, id);
  revalidatePath('/dashboard/crm/settings/saved-searches');
  return r;
}

/**
 * Universal search skeleton: runs a tenant-scoped, case-insensitive
 * match across the four primary CRM collections. Callers can extend
 * the module list as needed.
 */
export async function universalSearch(term: string) {
  const user = await requireSession();
  if (!user || !term || !term.trim()) return { results: [] as any[] };
  const { db } = await connectToDatabase();
  const rx = new RegExp(term.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const uid = new ObjectId(user._id);

  const [contacts, deals, tasks, projects] = await Promise.all([
    db
      .collection('crm_contacts')
      .find({ userId: uid, $or: [{ name: rx }, { email: rx }] })
      .project({ name: 1, email: 1 })
      .limit(10)
      .toArray(),
    db
      .collection('crm_deals')
      .find({ userId: uid, name: rx })
      .project({ name: 1 })
      .limit(10)
      .toArray(),
    db
      .collection('crm_tasks')
      .find({ userId: uid, heading: rx })
      .project({ heading: 1 })
      .limit(10)
      .toArray(),
    db
      .collection('crm_projects')
      .find({ userId: uid, projectName: rx })
      .project({ projectName: 1 })
      .limit(10)
      .toArray(),
  ]);

  const results = [
    ...contacts.map((d) => ({
      module: 'contacts',
      id: String(d._id),
      label: d.name || d.email || 'Contact',
    })),
    ...deals.map((d) => ({
      module: 'deals',
      id: String(d._id),
      label: d.name || 'Deal',
    })),
    ...tasks.map((d) => ({
      module: 'tasks',
      id: String(d._id),
      label: d.heading || 'Task',
    })),
    ...projects.map((d) => ({
      module: 'projects',
      id: String(d._id),
      label: d.projectName || 'Project',
    })),
  ];

  return { results };
}

/* ═══════════════════════════════════════════════════════════════════
 *  Issues — helpers complementing projects.actions
 * ══════════════════════════════════════════════════════════════════ */

export async function getIssueById(id: string) {
  return hrGetById<import('@/lib/worksuite/meta-types').WsIssue>(
    'crm_issues',
    id,
  );
}

/* ═══════════════════════════════════════════════════════════════════
 *  Taskboard Columns — bulk reorder helper.
 *  (Basic CRUD lives in `worksuite/projects.actions.ts`.)
 * ══════════════════════════════════════════════════════════════════ */

export async function reorderTaskboardColumns(
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
        },
        update: { $set: { priority: idx, updatedAt: new Date() } },
      },
    }));
  if (ops.length) await db.collection('crm_taskboard_columns').bulkWrite(ops);
  revalidatePath('/dashboard/crm/projects/taskboard-columns');
  return { success: true };
}
