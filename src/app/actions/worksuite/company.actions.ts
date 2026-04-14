'use server';

import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';

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
  WsCompanyProfile,
  WsCompanyAddress,
  WsCurrency,
  WsLanguageSetting,
  WsGlobalSetting,
  WsHierarchyNode,
  WsDepartmentExt,
  WsDesignationExt,
} from '@/lib/worksuite/company-types';

/**
 * Worksuite company/organization actions.
 *
 * Mirrors the HR CRUD style: generic `save*` actions take
 * `(prev, formData)` so they can plug into `useActionState` and
 * `HrEntityPage`. Singletons (`crm_company_profile`,
 * `crm_global_settings`) are keyed by `userId` — we upsert rather
 * than create multiple rows.
 */

type FormState = { message?: string; error?: string; id?: string };

const COLS = {
  profile: 'crm_company_profile',
  address: 'crm_company_addresses',
  currency: 'crm_currencies',
  language: 'crm_language_settings',
  global: 'crm_global_settings',
  department: 'crm_departments',
  designation: 'crm_designations',
} as const;

const PATHS = {
  profile: '/dashboard/crm/settings/company-profile',
  address: '/dashboard/crm/settings/company-addresses',
  currency: '/dashboard/crm/settings/currencies',
  language: '/dashboard/crm/settings/languages',
  global: '/dashboard/crm/settings/global',
  deptTree: '/dashboard/crm/hr-payroll/departments/hierarchy',
  desigTree: '/dashboard/crm/hr-payroll/designations/hierarchy',
} as const;

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
      if (data[k] !== undefined) {
        const v = String(data[k]).toLowerCase();
        data[k] = v === 'true' || v === 'yes' || v === '1' || v === 'on';
      } else {
        // unchecked checkboxes submit no value — persist as false for known keys
        data[k] = false;
      }
    }
    for (const k of options.jsonKeys || []) {
      if (typeof data[k] === 'string' && data[k]) {
        try {
          data[k] = JSON.parse(data[k]);
        } catch {
          /* ignore */
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

/* ═══════════════════ Company Profile (singleton) ═══════════════════ */

export async function getCompanyProfile(): Promise<WsCompanyProfile | null> {
  const user = await requireSession();
  if (!user) return null;
  const { db } = await connectToDatabase();
  const doc = await db
    .collection(COLS.profile)
    .findOne({ userId: new ObjectId(user._id) });
  return doc ? (serialize(doc) as unknown as WsCompanyProfile) : null;
}

export async function saveCompanyProfile(
  _prev: any,
  formData: FormData,
): Promise<FormState> {
  try {
    const user = await requireSession();
    if (!user) return { error: 'Access denied' };
    const data = formToObject(formData, [
      'fiscal_year_start_month',
      'first_day_of_week',
    ]);
    delete data._id;
    const { db } = await connectToDatabase();
    const now = new Date();
    await db.collection(COLS.profile).updateOne(
      { userId: new ObjectId(user._id) },
      {
        $set: { ...data, userId: new ObjectId(user._id), updatedAt: now },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );
    revalidatePath(PATHS.profile);
    return { message: 'Company profile saved.' };
  } catch (e: any) {
    return { error: e?.message || 'Failed to save' };
  }
}

/* ═══════════════════ Company Addresses ═══════════════════ */

export async function getCompanyAddresses() {
  return hrList<WsCompanyAddress>(COLS.address, {
    sortBy: { is_default: -1, createdAt: -1 },
  });
}
export async function getCompanyAddressById(id: string) {
  return hrGetById<WsCompanyAddress>(COLS.address, id);
}
export async function saveCompanyAddress(_prev: any, formData: FormData) {
  return genericSave(COLS.address, PATHS.address, formData, {
    boolKeys: ['is_default'],
    idFields: ['company_id'],
  });
}
export async function deleteCompanyAddress(id: string) {
  const r = await hrDelete(COLS.address, id);
  revalidatePath(PATHS.address);
  return r;
}

export async function setDefaultCompanyAddress(id: string) {
  const user = await requireSession();
  if (!user) return { success: false, error: 'Access denied' };
  if (!ObjectId.isValid(id)) return { success: false, error: 'Invalid id' };
  const { db } = await connectToDatabase();
  const userId = new ObjectId(user._id);
  await db
    .collection(COLS.address)
    .updateMany({ userId }, { $set: { is_default: false } });
  await db
    .collection(COLS.address)
    .updateOne({ _id: new ObjectId(id), userId }, { $set: { is_default: true } });
  revalidatePath(PATHS.address);
  return { success: true };
}

/* ═══════════════════ Currencies ═══════════════════ */

export async function getCurrencies() {
  return hrList<WsCurrency>(COLS.currency, {
    sortBy: { default: -1, code: 1 },
  });
}
export async function getCurrencyById(id: string) {
  return hrGetById<WsCurrency>(COLS.currency, id);
}
export async function saveCurrency(_prev: any, formData: FormData) {
  return genericSave(COLS.currency, PATHS.currency, formData, {
    boolKeys: ['is_cryptocurrency', 'default'],
    numericKeys: ['exchange_rate', 'usd_price', 'decimal_digits'],
  });
}
export async function deleteCurrency(id: string) {
  const r = await hrDelete(COLS.currency, id);
  revalidatePath(PATHS.currency);
  return r;
}

export async function setDefaultCurrency(id: string) {
  const user = await requireSession();
  if (!user) return { success: false, error: 'Access denied' };
  if (!ObjectId.isValid(id)) return { success: false, error: 'Invalid id' };
  const { db } = await connectToDatabase();
  const userId = new ObjectId(user._id);
  await db
    .collection(COLS.currency)
    .updateMany({ userId }, { $set: { default: false } });
  await db
    .collection(COLS.currency)
    .updateOne({ _id: new ObjectId(id), userId }, { $set: { default: true } });
  revalidatePath(PATHS.currency);
  return { success: true };
}

/* ═══════════════════ Languages ═══════════════════ */

export async function getLanguages() {
  return hrList<WsLanguageSetting>(COLS.language, {
    sortBy: { is_default: -1, language_name: 1 },
  });
}
export async function getLanguageById(id: string) {
  return hrGetById<WsLanguageSetting>(COLS.language, id);
}
export async function saveLanguage(_prev: any, formData: FormData) {
  return genericSave(COLS.language, PATHS.language, formData, {
    boolKeys: ['is_default', 'is_enabled'],
  });
}
export async function deleteLanguage(id: string) {
  const r = await hrDelete(COLS.language, id);
  revalidatePath(PATHS.language);
  return r;
}

export async function setDefaultLanguage(id: string) {
  const user = await requireSession();
  if (!user) return { success: false, error: 'Access denied' };
  if (!ObjectId.isValid(id)) return { success: false, error: 'Invalid id' };
  const { db } = await connectToDatabase();
  const userId = new ObjectId(user._id);
  await db
    .collection(COLS.language)
    .updateMany({ userId }, { $set: { is_default: false } });
  await db
    .collection(COLS.language)
    .updateOne({ _id: new ObjectId(id), userId }, { $set: { is_default: true } });
  revalidatePath(PATHS.language);
  return { success: true };
}

/* ═══════════════════ Global Settings (singleton) ═══════════════════ */

export async function getGlobalSettings(): Promise<WsGlobalSetting | null> {
  const user = await requireSession();
  if (!user) return null;
  const { db } = await connectToDatabase();
  const doc = await db
    .collection(COLS.global)
    .findOne({ userId: new ObjectId(user._id) });
  return doc ? (serialize(doc) as unknown as WsGlobalSetting) : null;
}

export async function saveGlobalSettings(
  _prev: any,
  formData: FormData,
): Promise<FormState> {
  try {
    const user = await requireSession();
    if (!user) return { error: 'Access denied' };
    const data = formToObject(formData);
    delete data._id;
    for (const k of ['strict_timezone', 'rtl', 'email_verified']) {
      if (data[k] !== undefined) {
        const v = String(data[k]).toLowerCase();
        data[k] = v === 'true' || v === 'yes' || v === '1' || v === 'on';
      } else {
        data[k] = false;
      }
    }
    if (typeof data.currency_id === 'string' && ObjectId.isValid(data.currency_id)) {
      data.currency_id = new ObjectId(data.currency_id);
    }
    const { db } = await connectToDatabase();
    const now = new Date();
    await db.collection(COLS.global).updateOne(
      { userId: new ObjectId(user._id) },
      {
        $set: { ...data, userId: new ObjectId(user._id), updatedAt: now },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );
    revalidatePath(PATHS.global);
    return { message: 'Global settings saved.' };
  } catch (e: any) {
    return { error: e?.message || 'Failed to save' };
  }
}

/* ═══════════════════ Departments — Hierarchy extension ═══════════════════ */

export async function getDepartmentsExt(): Promise<WsDepartmentExt[]> {
  const user = await requireSession();
  if (!user) return [];
  const { db } = await connectToDatabase();
  const docs = await db
    .collection(COLS.department)
    .find({ userId: new ObjectId(user._id) })
    .sort({ name: 1 })
    .toArray();
  return serialize(docs) as unknown as WsDepartmentExt[];
}

export async function saveDepartmentExt(
  _prev: any,
  formData: FormData,
): Promise<FormState> {
  try {
    const user = await requireSession();
    if (!user) return { error: 'Access denied' };
    const data = formToObject(formData);
    const { db } = await connectToDatabase();
    const now = new Date();
    const parent =
      typeof data.parent_department_id === 'string' &&
      ObjectId.isValid(data.parent_department_id)
        ? new ObjectId(data.parent_department_id)
        : null;
    const base: Record<string, any> = {
      userId: new ObjectId(user._id),
      name: data.name,
      description: data.description,
      parent_department_id: parent,
      updatedAt: now,
    };
    if (data._id && typeof data._id === 'string' && ObjectId.isValid(data._id)) {
      await db
        .collection(COLS.department)
        .updateOne(
          { _id: new ObjectId(data._id), userId: new ObjectId(user._id) },
          { $set: base },
        );
      revalidatePath(PATHS.deptTree);
      return { message: 'Department updated.', id: data._id };
    }
    const res = await db
      .collection(COLS.department)
      .insertOne({ ...base, createdAt: now });
    revalidatePath(PATHS.deptTree);
    return { message: 'Department created.', id: res.insertedId.toString() };
  } catch (e: any) {
    return { error: e?.message || 'Failed to save' };
  }
}

export async function setDepartmentParent(
  id: string,
  parentId: string | null,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireSession();
  if (!user) return { success: false, error: 'Access denied' };
  if (!ObjectId.isValid(id)) return { success: false, error: 'Invalid id' };
  if (parentId && !ObjectId.isValid(parentId)) {
    return { success: false, error: 'Invalid parent id' };
  }
  if (parentId && parentId === id) {
    return { success: false, error: 'A node cannot be its own parent.' };
  }
  const { db } = await connectToDatabase();
  await db.collection(COLS.department).updateOne(
    { _id: new ObjectId(id), userId: new ObjectId(user._id) },
    {
      $set: {
        parent_department_id: parentId ? new ObjectId(parentId) : null,
        updatedAt: new Date(),
      },
    },
  );
  revalidatePath(PATHS.deptTree);
  return { success: true };
}

export async function getDepartmentTree(): Promise<WsHierarchyNode[]> {
  const rows = await getDepartmentsExt();
  return buildTree(
    rows.map((r) => ({
      _id: String(r._id),
      name: String(r.name || ''),
      description: r.description,
      parent_id:
        r.parent_department_id != null ? String(r.parent_department_id) : null,
    })),
  );
}

/* ═══════════════════ Designations — Hierarchy extension ═══════════════════ */

export async function getDesignationsExt(): Promise<WsDesignationExt[]> {
  const user = await requireSession();
  if (!user) return [];
  const { db } = await connectToDatabase();
  const docs = await db
    .collection(COLS.designation)
    .find({ userId: new ObjectId(user._id) })
    .sort({ name: 1 })
    .toArray();
  return serialize(docs) as unknown as WsDesignationExt[];
}

export async function saveDesignationExt(
  _prev: any,
  formData: FormData,
): Promise<FormState> {
  try {
    const user = await requireSession();
    if (!user) return { error: 'Access denied' };
    const data = formToObject(formData);
    const { db } = await connectToDatabase();
    const now = new Date();
    const parent =
      typeof data.parent_designation_id === 'string' &&
      ObjectId.isValid(data.parent_designation_id)
        ? new ObjectId(data.parent_designation_id)
        : null;
    const base: Record<string, any> = {
      userId: new ObjectId(user._id),
      name: data.name,
      description: data.description,
      parent_designation_id: parent,
      updatedAt: now,
    };
    if (data._id && typeof data._id === 'string' && ObjectId.isValid(data._id)) {
      await db
        .collection(COLS.designation)
        .updateOne(
          { _id: new ObjectId(data._id), userId: new ObjectId(user._id) },
          { $set: base },
        );
      revalidatePath(PATHS.desigTree);
      return { message: 'Designation updated.', id: data._id };
    }
    const res = await db
      .collection(COLS.designation)
      .insertOne({ ...base, createdAt: now });
    revalidatePath(PATHS.desigTree);
    return { message: 'Designation created.', id: res.insertedId.toString() };
  } catch (e: any) {
    return { error: e?.message || 'Failed to save' };
  }
}

export async function setDesignationParent(
  id: string,
  parentId: string | null,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireSession();
  if (!user) return { success: false, error: 'Access denied' };
  if (!ObjectId.isValid(id)) return { success: false, error: 'Invalid id' };
  if (parentId && !ObjectId.isValid(parentId)) {
    return { success: false, error: 'Invalid parent id' };
  }
  if (parentId && parentId === id) {
    return { success: false, error: 'A node cannot be its own parent.' };
  }
  const { db } = await connectToDatabase();
  await db.collection(COLS.designation).updateOne(
    { _id: new ObjectId(id), userId: new ObjectId(user._id) },
    {
      $set: {
        parent_designation_id: parentId ? new ObjectId(parentId) : null,
        updatedAt: new Date(),
      },
    },
  );
  revalidatePath(PATHS.desigTree);
  return { success: true };
}

export async function getDesignationTree(): Promise<WsHierarchyNode[]> {
  const rows = await getDesignationsExt();
  return buildTree(
    rows.map((r) => ({
      _id: String(r._id),
      name: String(r.name || ''),
      description: r.description,
      parent_id:
        r.parent_designation_id != null ? String(r.parent_designation_id) : null,
    })),
  );
}

/* ═══════════════════ Shared tree builder ═══════════════════ */

function buildTree(
  rows: { _id: string; name: string; description?: string; parent_id: string | null }[],
): WsHierarchyNode[] {
  const map = new Map<string, WsHierarchyNode>();
  for (const r of rows) {
    map.set(r._id, { ...r, children: [] });
  }
  const roots: WsHierarchyNode[] = [];
  for (const node of map.values()) {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  // Stable alphabetical ordering within each level
  const sortRec = (nodes: WsHierarchyNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    for (const n of nodes) sortRec(n.children);
  };
  sortRec(roots);
  return roots;
}

export async function deleteDepartmentExt(id: string) {
  const r = await hrDelete(COLS.department, id);
  revalidatePath(PATHS.deptTree);
  return r;
}
export async function deleteDesignationExt(id: string) {
  const r = await hrDelete(COLS.designation, id);
  revalidatePath(PATHS.desigTree);
  return r;
}
