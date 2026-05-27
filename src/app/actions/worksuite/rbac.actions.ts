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
  WsRole,
  WsRoleUser,
  WsPermission,
  WsPermissionType,
  WsPermissionTypeName,
  WsPermissionRole,
  WsUserPermission,
  WsModule,
  WsModuleSetting,
  WsCustomModule,
  WsCustomModulePermission,
  WsMenu,
} from '@/lib/worksuite/rbac-types';

/**
 * Worksuite RBAC — tenant-scoped role/permission/module CRUD plus the
 * assignment + check helpers. Each tenant (ObjectId stored as `userId`)
 * keeps its own set of roles, permissions, modules, and menu entries.
 *
 * Collections:
 *   crm_roles, crm_role_users, crm_permissions, crm_permission_types,
 *   crm_permission_role, crm_user_permissions, crm_modules,
 *   crm_module_settings, crm_custom_modules,
 *   crm_custom_module_permissions, crm_menu.
 */

type FormState = { message?: string; error?: string; id?: string };

const COLS = {
  role: 'crm_roles',
  roleUser: 'crm_role_users',
  permission: 'crm_permissions',
  permissionType: 'crm_permission_types',
  permissionRole: 'crm_permission_role',
  userPermission: 'crm_user_permissions',
  module: 'crm_modules',
  moduleSetting: 'crm_module_settings',
  customModule: 'crm_custom_modules',
  customModulePermission: 'crm_custom_module_permissions',
  menu: 'crm_menu',
} as const;

const ROLES_PATH = '/dashboard/crm/settings/roles';
const PERMS_PATH = '/dashboard/crm/settings/permissions';
const PTYPES_PATH = '/dashboard/crm/settings/permission-types';
const MODULES_PATH = '/dashboard/crm/settings/modules';
const CUSTOM_MOD_PATH = '/dashboard/crm/settings/custom-modules';
const MENU_PATH = '/dashboard/crm/settings/menu';

/* ─── helpers ─────────────────────────────────────────────────────── */

function asBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    return s === '1' || s === 'true' || s === 'yes' || s === 'on';
  }
  return false;
}

function slugify(input: string): string {
  return String(input)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function toObjectIdOrNull(v: unknown): ObjectId | null {
  if (typeof v === 'string' && ObjectId.isValid(v)) return new ObjectId(v);
  return null;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Roles
 * ══════════════════════════════════════════════════════════════════ */

export async function getRoles() {
  return hrList<WsRole>(COLS.role, { sortBy: { display_name: 1 } });
}

export async function getRoleById(id: string) {
  return hrGetById<WsRole>(COLS.role, id);
}

/** Roles augmented with assigned member counts for the list page. */
export async function getRolesWithCounts(): Promise<
  (WsRole & { _id: string; memberCount: number })[]
> {
  const user = await requireSession();
  if (!user) return [];
  const { db } = await connectToDatabase();
  const roles = (await db
    .collection(COLS.role)
    .find({ userId: new ObjectId(user._id) })
    .sort({ display_name: 1 })
    .toArray()) as any[];
  if (roles.length === 0) return [];
  const counts = await db
    .collection(COLS.roleUser)
    .aggregate([
      { $match: { userId: new ObjectId(user._id) } },
      { $group: { _id: '$role_id', count: { $sum: 1 } } },
    ])
    .toArray();
  const map = new Map<string, number>();
  for (const c of counts) map.set(String(c._id), Number(c.count || 0));
  return serialize(
    roles.map((r) => ({ ...r, memberCount: map.get(String(r._id)) || 0 })),
  ) as any;
}

export async function saveRole(_prev: any, formData: FormData): Promise<FormState> {
  try {
    const raw = formToObject(formData);
    raw.is_admin = asBool(raw.is_admin);
    raw.is_system = asBool(raw.is_system);
    if (!raw.name && raw.display_name) raw.name = slugify(raw.display_name);
    else if (raw.name) raw.name = slugify(raw.name);
    if (!raw.name) return { error: 'Role name is required' };
    const res = await hrSave(COLS.role, raw);
    if (res.error) return { error: res.error };
    revalidatePath(ROLES_PATH);
    return { message: 'Role saved.', id: res.id };
  } catch (e: any) {
    return { error: e?.message || 'Failed to save role' };
  }
}

export async function deleteRole(id: string) {
  // cascade delete the role's pivots
  const user = await requireSession();
  if (user && ObjectId.isValid(id)) {
    const { db } = await connectToDatabase();
    const tenant = new ObjectId(user._id);
    const roleId = new ObjectId(id);
    await db
      .collection(COLS.roleUser)
      .deleteMany({ userId: tenant, role_id: roleId });
    await db
      .collection(COLS.permissionRole)
      .deleteMany({ userId: tenant, role_id: roleId });
    await db
      .collection(COLS.customModulePermission)
      .deleteMany({ userId: tenant, role_id: roleId });
  }
  const r = await hrDelete(COLS.role, id);
  revalidatePath(ROLES_PATH);
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Role ↔ User assignment
 * ══════════════════════════════════════════════════════════════════ */

export async function getRoleMembers(roleId: string) {
  const user = await requireSession();
  if (!user || !ObjectId.isValid(roleId)) return [];
  const { db } = await connectToDatabase();
  const rows = await db
    .collection(COLS.roleUser)
    .find({
      userId: new ObjectId(user._id),
      role_id: new ObjectId(roleId),
    })
    .sort({ createdAt: -1 })
    .toArray();
  return serialize(rows) as (WsRoleUser & { _id: string })[];
}

export async function assignUserToRole(
  roleId: string,
  targetUserId: string,
  opts: { user_name?: string; user_email?: string } = {},
): Promise<{ success: boolean; error?: string; id?: string }> {
  const user = await requireSession();
  if (!user) return { success: false, error: 'Access denied' };
  if (!ObjectId.isValid(roleId)) return { success: false, error: 'Invalid role' };
  const val = String(targetUserId || '').trim();
  if (!val) return { success: false, error: 'Target user required' };
  const { db } = await connectToDatabase();
  const tenant = new ObjectId(user._id);
  const rid = new ObjectId(roleId);
  const existing = await db.collection(COLS.roleUser).findOne({
    userId: tenant,
    role_id: rid,
    user_id: val,
  });
  if (existing) return { success: true, id: String(existing._id) };
  const now = new Date();
  const res = await db.collection(COLS.roleUser).insertOne({
    userId: tenant,
    role_id: rid,
    user_id: val,
    user_name: opts.user_name || '',
    user_email: opts.user_email || '',
    createdAt: now,
    updatedAt: now,
  });
  revalidatePath(`${ROLES_PATH}/${roleId}`);
  return { success: true, id: res.insertedId.toString() };
}

export async function removeUserFromRole(
  roleId: string,
  targetUserId: string,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireSession();
  if (!user) return { success: false, error: 'Access denied' };
  if (!ObjectId.isValid(roleId)) return { success: false, error: 'Invalid role' };
  const { db } = await connectToDatabase();
  await db.collection(COLS.roleUser).deleteMany({
    userId: new ObjectId(user._id),
    role_id: new ObjectId(roleId),
    user_id: String(targetUserId || ''),
  });
  revalidatePath(`${ROLES_PATH}/${roleId}`);
  return { success: true };
}

/* ═══════════════════════════════════════════════════════════════════
 *  Permissions
 * ══════════════════════════════════════════════════════════════════ */

export async function getPermissions() {
  return hrList<WsPermission>(COLS.permission, { sortBy: { display_name: 1 } });
}

export async function getPermissionById(id: string) {
  return hrGetById<WsPermission>(COLS.permission, id);
}

/** Permissions grouped by module (with the module joined in). */
export async function getPermissionsGroupedByModule(): Promise<
  {
    module: (WsModule & { _id: string }) | null;
    permissions: (WsPermission & { _id: string })[];
  }[]
> {
  const user = await requireSession();
  if (!user) return [];
  const { db } = await connectToDatabase();
  const tenant = new ObjectId(user._id);
  const [perms, modules] = await Promise.all([
    db
      .collection(COLS.permission)
      .find({ userId: tenant })
      .sort({ display_name: 1 })
      .toArray(),
    db
      .collection(COLS.module)
      .find({ userId: tenant })
      .sort({ display_name: 1 })
      .toArray(),
  ]);
  const modMap = new Map<string, any>();
  for (const m of modules) modMap.set(String(m._id), m);
  const bucket = new Map<string, any[]>();
  const orphan: any[] = [];
  for (const p of perms) {
    const key = p.module_id ? String(p.module_id) : '';
    if (!key) orphan.push(p);
    else {
      if (!bucket.has(key)) bucket.set(key, []);
      bucket.get(key)!.push(p);
    }
  }
  const out: any[] = [];
  for (const m of modules) {
    const list = bucket.get(String(m._id)) || [];
    out.push({ module: m, permissions: list });
  }
  if (orphan.length) out.push({ module: null, permissions: orphan });
  return serialize(out) as any;
}

export async function savePermission(_prev: any, formData: FormData): Promise<FormState> {
  try {
    const raw = formToObject(formData);
    if (!raw.name && raw.display_name) raw.name = slugify(raw.display_name);
    else if (raw.name) raw.name = slugify(raw.name);
    if (!raw.name) return { error: 'Permission name is required' };
    raw.is_custom = asBool(raw.is_custom);
    const res = await hrSave(COLS.permission, raw, {
      idFields: ['module_id', 'type_id'],
    });
    if (res.error) return { error: res.error };
    revalidatePath(PERMS_PATH);
    return { message: 'Permission saved.', id: res.id };
  } catch (e: any) {
    return { error: e?.message || 'Failed to save permission' };
  }
}

export async function deletePermission(id: string) {
  const user = await requireSession();
  if (user && ObjectId.isValid(id)) {
    const { db } = await connectToDatabase();
    const tenant = new ObjectId(user._id);
    const pid = new ObjectId(id);
    await db
      .collection(COLS.permissionRole)
      .deleteMany({ userId: tenant, permission_id: pid });
    await db
      .collection(COLS.userPermission)
      .deleteMany({ userId: tenant, permission_id: pid });
  }
  const r = await hrDelete(COLS.permission, id);
  revalidatePath(PERMS_PATH);
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Permission Types
 * ══════════════════════════════════════════════════════════════════ */

export async function getPermissionTypes() {
  return hrList<WsPermissionType>(COLS.permissionType, { sortBy: { name: 1 } });
}

export async function getPermissionTypeById(id: string) {
  return hrGetById<WsPermissionType>(COLS.permissionType, id);
}

export async function savePermissionType(
  _prev: any,
  formData: FormData,
): Promise<FormState> {
  try {
    const raw = formToObject(formData);
    if (raw.name) raw.name = String(raw.name).trim().toLowerCase();
    if (!raw.name) return { error: 'Type name is required' };
    const res = await hrSave(COLS.permissionType, raw);
    if (res.error) return { error: res.error };
    revalidatePath(PTYPES_PATH);
    return { message: 'Type saved.', id: res.id };
  } catch (e: any) {
    return { error: e?.message || 'Failed to save type' };
  }
}

export async function deletePermissionType(id: string) {
  const r = await hrDelete(COLS.permissionType, id);
  revalidatePath(PTYPES_PATH);
  return r;
}

/**
 * Seed the 5 standard permission types (none/all/added/owned/both).
 * Idempotent — inserts only the ones missing for this tenant.
 */
export async function seedPermissionTypes(): Promise<{ inserted: number }> {
  const user = await requireSession();
  if (!user) return { inserted: 0 };
  const { db } = await connectToDatabase();
  const tenant = new ObjectId(user._id);
  const names: Array<{ name: 'none' | 'all' | 'added' | 'owned' | 'both'; label: string }> = [
    { name: 'none', label: 'None' },
    { name: 'all', label: 'All' },
    { name: 'added', label: 'Added by me' },
    { name: 'owned', label: 'Owned by me' },
    { name: 'both', label: 'Added & Owned' },
  ];
  const existing = await db
    .collection(COLS.permissionType)
    .find({ userId: tenant })
    .project({ name: 1 })
    .toArray();
  const have = new Set(existing.map((x: any) => String(x.name)));
  const now = new Date();
  const toInsert = names
    .filter((n) => !have.has(n.name))
    .map((n) => ({
      userId: tenant,
      name: n.name,
      display_name: n.label,
      createdAt: now,
      updatedAt: now,
    }));
  if (toInsert.length) {
    await db.collection(COLS.permissionType).insertMany(toInsert);
  }
  revalidatePath(PTYPES_PATH);
  return { inserted: toInsert.length };
}

/* ═══════════════════════════════════════════════════════════════════
 *  Permission ↔ Role grants
 * ══════════════════════════════════════════════════════════════════ */

export async function getPermissionsForRole(
  roleId: string,
): Promise<(WsPermissionRole & { _id: string })[]> {
  const user = await requireSession();
  if (!user || !ObjectId.isValid(roleId)) return [];
  const { db } = await connectToDatabase();
  const rows = await db
    .collection(COLS.permissionRole)
    .find({
      userId: new ObjectId(user._id),
      role_id: new ObjectId(roleId),
    })
    .toArray();
  return serialize(rows) as any;
}

export async function grantPermissionToRole(
  permissionId: string,
  roleId: string,
  permissionTypeId: string,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireSession();
  if (!user) return { success: false, error: 'Access denied' };
  if (!ObjectId.isValid(permissionId) || !ObjectId.isValid(roleId) || !ObjectId.isValid(permissionTypeId))
    return { success: false, error: 'Invalid identifiers' };
  const { db } = await connectToDatabase();
  const tenant = new ObjectId(user._id);
  const filter = {
    userId: tenant,
    permission_id: new ObjectId(permissionId),
    role_id: new ObjectId(roleId),
  };
  const now = new Date();
  await db.collection(COLS.permissionRole).updateOne(
    filter,
    {
      $set: {
        ...filter,
        permission_type_id: new ObjectId(permissionTypeId),
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );
  revalidatePath(`${ROLES_PATH}/${roleId}`);
  return { success: true };
}

export async function revokePermissionFromRole(
  permissionId: string,
  roleId: string,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireSession();
  if (!user) return { success: false, error: 'Access denied' };
  if (!ObjectId.isValid(permissionId) || !ObjectId.isValid(roleId))
    return { success: false, error: 'Invalid identifiers' };
  const { db } = await connectToDatabase();
  await db.collection(COLS.permissionRole).deleteOne({
    userId: new ObjectId(user._id),
    permission_id: new ObjectId(permissionId),
    role_id: new ObjectId(roleId),
  });
  revalidatePath(`${ROLES_PATH}/${roleId}`);
  return { success: true };
}

/* ═══════════════════════════════════════════════════════════════════
 *  User-level permission overrides
 * ══════════════════════════════════════════════════════════════════ */

export async function getUserPermissions(targetUserId: string) {
  const user = await requireSession();
  if (!user) return [];
  const { db } = await connectToDatabase();
  const rows = await db
    .collection(COLS.userPermission)
    .find({
      userId: new ObjectId(user._id),
      target_user_id: String(targetUserId || ''),
    })
    .toArray();
  return serialize(rows) as (WsUserPermission & { _id: string })[];
}

export async function grantPermissionToUser(
  targetUserId: string,
  permissionId: string,
  typeId: string,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireSession();
  if (!user) return { success: false, error: 'Access denied' };
  if (!ObjectId.isValid(permissionId) || !ObjectId.isValid(typeId))
    return { success: false, error: 'Invalid identifiers' };
  const val = String(targetUserId || '').trim();
  if (!val) return { success: false, error: 'Target user required' };
  const { db } = await connectToDatabase();
  const tenant = new ObjectId(user._id);
  const filter = {
    userId: tenant,
    target_user_id: val,
    permission_id: new ObjectId(permissionId),
  };
  const now = new Date();
  await db.collection(COLS.userPermission).updateOne(
    filter,
    {
      $set: {
        ...filter,
        permission_type_id: new ObjectId(typeId),
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );
  return { success: true };
}

export async function revokePermissionFromUser(
  targetUserId: string,
  permissionId: string,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireSession();
  if (!user) return { success: false, error: 'Access denied' };
  if (!ObjectId.isValid(permissionId))
    return { success: false, error: 'Invalid permission' };
  const { db } = await connectToDatabase();
  await db.collection(COLS.userPermission).deleteOne({
    userId: new ObjectId(user._id),
    target_user_id: String(targetUserId || ''),
    permission_id: new ObjectId(permissionId),
  });
  return { success: true };
}

/* ═══════════════════════════════════════════════════════════════════
 *  Modules
 * ══════════════════════════════════════════════════════════════════ */

export async function getModules() {
  return hrList<WsModule>(COLS.module, { sortBy: { display_name: 1 } });
}

export async function getModuleById(id: string) {
  return hrGetById<WsModule>(COLS.module, id);
}

export async function saveModule(_prev: any, formData: FormData): Promise<FormState> {
  try {
    const raw = formToObject(formData);
    raw.is_active = asBool(raw.is_active);
    raw.in_menu = asBool(raw.in_menu);
    if (!raw.module_name && raw.display_name)
      raw.module_name = slugify(raw.display_name);
    else if (raw.module_name) raw.module_name = slugify(raw.module_name);
    if (!raw.module_name) return { error: 'Module name is required' };
    const res = await hrSave(COLS.module, raw);
    if (res.error) return { error: res.error };
    revalidatePath(MODULES_PATH);
    return { message: 'Module saved.', id: res.id };
  } catch (e: any) {
    return { error: e?.message || 'Failed to save module' };
  }
}

export async function deleteModule(id: string) {
  const r = await hrDelete(COLS.module, id);
  revalidatePath(MODULES_PATH);
  return r;
}

/** Flip `is_active` for the module. */
export async function toggleModule(
  moduleId: string,
): Promise<{ success: boolean; is_active?: boolean; error?: string }> {
  const user = await requireSession();
  if (!user) return { success: false, error: 'Access denied' };
  if (!ObjectId.isValid(moduleId))
    return { success: false, error: 'Invalid module' };
  const { db } = await connectToDatabase();
  const tenant = new ObjectId(user._id);
  const mid = new ObjectId(moduleId);
  const current = await db
    .collection(COLS.module)
    .findOne({ _id: mid, userId: tenant });
  if (!current) return { success: false, error: 'Not found' };
  const next = !current.is_active;
  await db
    .collection(COLS.module)
    .updateOne(
      { _id: mid, userId: tenant },
      { $set: { is_active: next, updatedAt: new Date() } },
    );
  revalidatePath(MODULES_PATH);
  return { success: true, is_active: next };
}

export async function toggleModuleInMenu(
  moduleId: string,
): Promise<{ success: boolean; in_menu?: boolean; error?: string }> {
  const user = await requireSession();
  if (!user) return { success: false, error: 'Access denied' };
  if (!ObjectId.isValid(moduleId))
    return { success: false, error: 'Invalid module' };
  const { db } = await connectToDatabase();
  const tenant = new ObjectId(user._id);
  const mid = new ObjectId(moduleId);
  const current = await db
    .collection(COLS.module)
    .findOne({ _id: mid, userId: tenant });
  if (!current) return { success: false, error: 'Not found' };
  const next = !current.in_menu;
  await db
    .collection(COLS.module)
    .updateOne(
      { _id: mid, userId: tenant },
      { $set: { in_menu: next, updatedAt: new Date() } },
    );
  revalidatePath(MODULES_PATH);
  return { success: true, in_menu: next };
}

/* ═══════════════════════════════════════════════════════════════════
 *  Module Settings
 * ══════════════════════════════════════════════════════════════════ */

export async function getModuleSettings() {
  return hrList<WsModuleSetting>(COLS.moduleSetting, {});
}

export async function saveModuleSetting(
  _prev: any,
  formData: FormData,
): Promise<FormState> {
  try {
    const raw = formToObject(formData);
    raw.is_allowed = asBool(raw.is_allowed);
    const res = await hrSave(COLS.moduleSetting, raw, {
      idFields: ['module_id'],
    });
    if (res.error) return { error: res.error };
    revalidatePath(MODULES_PATH);
    return { message: 'Setting saved.', id: res.id };
  } catch (e: any) {
    return { error: e?.message || 'Failed to save setting' };
  }
}

export async function deleteModuleSetting(id: string) {
  const r = await hrDelete(COLS.moduleSetting, id);
  revalidatePath(MODULES_PATH);
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Custom Modules + per-role permissions
 * ══════════════════════════════════════════════════════════════════ */

export async function getCustomModules() {
  return hrList<WsCustomModule>(COLS.customModule, {
    sortBy: { display_name: 1 },
  });
}

export async function getCustomModuleById(id: string) {
  return hrGetById<WsCustomModule>(COLS.customModule, id);
}

export async function saveCustomModule(
  _prev: any,
  formData: FormData,
): Promise<FormState> {
  try {
    const raw = formToObject(formData);
    if (!raw.name && raw.display_name) raw.name = slugify(raw.display_name);
    else if (raw.name) raw.name = slugify(raw.name);
    if (!raw.name) return { error: 'Name is required' };
    const res = await hrSave(COLS.customModule, raw);
    if (res.error) return { error: res.error };
    revalidatePath(CUSTOM_MOD_PATH);
    return { message: 'Custom module saved.', id: res.id };
  } catch (e: any) {
    return { error: e?.message || 'Failed to save' };
  }
}

export async function deleteCustomModule(id: string) {
  const user = await requireSession();
  if (user && ObjectId.isValid(id)) {
    const { db } = await connectToDatabase();
    await db
      .collection(COLS.customModulePermission)
      .deleteMany({
        userId: new ObjectId(user._id),
        custom_module_id: new ObjectId(id),
      });
  }
  const r = await hrDelete(COLS.customModule, id);
  revalidatePath(CUSTOM_MOD_PATH);
  return r;
}

export async function getCustomModulePermissions() {
  return hrList<WsCustomModulePermission>(COLS.customModulePermission, {});
}

export async function setCustomModulePermission(
  customModuleId: string,
  roleId: string,
  flags: {
    can_view?: boolean;
    can_create?: boolean;
    can_edit?: boolean;
    can_delete?: boolean;
  },
): Promise<{ success: boolean; error?: string }> {
  const user = await requireSession();
  if (!user) return { success: false, error: 'Access denied' };
  if (!ObjectId.isValid(customModuleId) || !ObjectId.isValid(roleId))
    return { success: false, error: 'Invalid identifiers' };
  const { db } = await connectToDatabase();
  const tenant = new ObjectId(user._id);
  const filter = {
    userId: tenant,
    custom_module_id: new ObjectId(customModuleId),
    role_id: new ObjectId(roleId),
  };
  const now = new Date();
  await db.collection(COLS.customModulePermission).updateOne(
    filter,
    {
      $set: {
        ...filter,
        can_view: !!flags.can_view,
        can_create: !!flags.can_create,
        can_edit: !!flags.can_edit,
        can_delete: !!flags.can_delete,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );
  revalidatePath(CUSTOM_MOD_PATH);
  return { success: true };
}

/* ═══════════════════════════════════════════════════════════════════
 *  Menu
 * ══════════════════════════════════════════════════════════════════ */

export async function getMenu() {
  return hrList<WsMenu>(COLS.menu, { sortBy: { position: 1 } });
}

export async function getMenuById(id: string) {
  return hrGetById<WsMenu>(COLS.menu, id);
}

export async function saveMenu(_prev: any, formData: FormData): Promise<FormState> {
  try {
    const raw = formToObject(formData, ['position']);
    raw.is_visible = asBool(raw.is_visible);
    if (raw.parent_id === '' || raw.parent_id === 'none') raw.parent_id = null;
    if (!raw.label) return { error: 'Label is required' };
    const res = await hrSave(COLS.menu, raw, { idFields: ['parent_id'] });
    if (res.error) return { error: res.error };
    revalidatePath(MENU_PATH);
    return { message: 'Menu saved.', id: res.id };
  } catch (e: any) {
    return { error: e?.message || 'Failed to save menu' };
  }
}

export async function deleteMenu(id: string) {
  const r = await hrDelete(COLS.menu, id);
  revalidatePath(MENU_PATH);
  return r;
}

export async function toggleMenuVisibility(
  id: string,
): Promise<{ success: boolean; is_visible?: boolean; error?: string }> {
  const user = await requireSession();
  if (!user) return { success: false, error: 'Access denied' };
  if (!ObjectId.isValid(id)) return { success: false, error: 'Invalid id' };
  const { db } = await connectToDatabase();
  const tenant = new ObjectId(user._id);
  const oid = new ObjectId(id);
  const current = await db
    .collection(COLS.menu)
    .findOne({ _id: oid, userId: tenant });
  if (!current) return { success: false, error: 'Not found' };
  const next = !current.is_visible;
  await db
    .collection(COLS.menu)
    .updateOne(
      { _id: oid, userId: tenant },
      { $set: { is_visible: next, updatedAt: new Date() } },
    );
  revalidatePath(MENU_PATH);
  return { success: true, is_visible: next };
}

/** Bulk reorder menu entries — ids in the desired order. */
export async function reorderMenu(
  orderedIds: string[],
): Promise<{ success: boolean; error?: string }> {
  const user = await requireSession();
  if (!user) return { success: false, error: 'Access denied' };
  const { db } = await connectToDatabase();
  const tenant = new ObjectId(user._id);
  const ops = (orderedIds || [])
    .filter((id) => ObjectId.isValid(id))
    .map((id, idx) => ({
      updateOne: {
        filter: { _id: new ObjectId(id), userId: tenant },
        update: { $set: { position: idx, updatedAt: new Date() } },
      },
    }));
  if (ops.length) await db.collection(COLS.menu).bulkWrite(ops);
  revalidatePath(MENU_PATH);
  return { success: true };
}

/* ═══════════════════════════════════════════════════════════════════
 *  userHasPermission — resolve via role → permission_role → type.
 *
 *  A user has a permission if ANY of their roles has a grant whose
 *  permission_type is NOT `none`. User-level overrides trump role
 *  grants. Tenant admins (any role with `is_admin = true`) always win.
 * ══════════════════════════════════════════════════════════════════ */

export async function userHasPermission(
  permissionName: string,
  targetUserId?: string,
): Promise<boolean> {
  const session = await requireSession();
  if (!session) return false;
  const { db } = await connectToDatabase();
  const tenant = new ObjectId(session._id);
  const uid = String(targetUserId || session._id);

  // 1. Resolve the permission by name.
  const perm = await db
    .collection(COLS.permission)
    .findOne({ userId: tenant, name: permissionName });
  if (!perm) return false;

  // 2. User-level override wins if present.
  const override = await db.collection(COLS.userPermission).findOne({
    userId: tenant,
    target_user_id: uid,
    permission_id: perm._id,
  });
  if (override && ObjectId.isValid(override.permission_type_id)) {
    const t = await db
      .collection(COLS.permissionType)
      .findOne({ _id: override.permission_type_id });
    if (t) return t.name !== 'none';
  }

  // 3. Collect user's role ids.
  const roleRows = await db
    .collection(COLS.roleUser)
    .find({ userId: tenant, user_id: uid })
    .project({ role_id: 1 })
    .toArray();
  const roleIds = roleRows
    .map((r: any) => r.role_id)
    .filter((v: any) => v) as ObjectId[];
  if (roleIds.length === 0) return false;

  // 4. Admin role short-circuit.
  const adminRole = await db
    .collection(COLS.role)
    .findOne({ userId: tenant, _id: { $in: roleIds }, is_admin: true });
  if (adminRole) return true;

  // 5. Any permissionRole grant with non-"none" type = granted.
  const grants = await db
    .collection(COLS.permissionRole)
    .find({
      userId: tenant,
      role_id: { $in: roleIds },
      permission_id: perm._id,
    })
    .toArray();
  if (grants.length === 0) return false;
  const typeIds = grants
    .map((g: any) => g.permission_type_id)
    .filter((v: any) => v) as ObjectId[];
  if (typeIds.length === 0) return false;
  const types = await db
    .collection(COLS.permissionType)
    .find({ _id: { $in: typeIds } })
    .toArray();
  return types.some((t: any) => t.name && t.name !== 'none');
}

/* ═══════════════════════════════════════════════════════════════════
 *  KPI helpers — settings list pages
 * ══════════════════════════════════════════════════════════════════ */

interface PermissionKpis {
  total: number;
  granted_role_count: number;
  top_role: { role_id: string; name: string; count: number } | null;
  last_updated_at: string | null;
}

/**
 * KPI roll-up for /settings/permissions. Returns total permission
 * rows, the count of distinct roles holding at least one non-`none`
 * grant, the most-permissioned role, and the most-recent permission
 * mutation timestamp.
 */
export async function getPermissionKpis(): Promise<PermissionKpis> {
  const user = await requireSession();
  if (!user) {
    return {
      total: 0,
      granted_role_count: 0,
      top_role: null,
      last_updated_at: null,
    };
  }
  const { db } = await connectToDatabase();
  const tenant = new ObjectId(user._id);

  const [permCount, permRows] = await Promise.all([
    db.collection(COLS.permission).countDocuments({ userId: tenant }),
    db
      .collection(COLS.permission)
      .find({ userId: tenant })
      .project({ updatedAt: 1, createdAt: 1 })
      .sort({ updatedAt: -1 })
      .limit(1)
      .toArray(),
  ]);

  // Build the {role -> grant count} map, excluding none-type grants.
  const noneType = await db
    .collection(COLS.permissionType)
    .findOne({ userId: tenant, name: 'none' });
  const noneId = noneType?._id ?? null;

  const grouped = await db
    .collection(COLS.permissionRole)
    .aggregate([
      {
        $match: {
          userId: tenant,
          ...(noneId ? { permission_type_id: { $ne: noneId } } : {}),
        },
      },
      { $group: { _id: '$role_id', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ])
    .toArray();

  let topRole: PermissionKpis['top_role'] = null;
  if (grouped.length > 0) {
    const top = grouped[0];
    const roleDoc = await db
      .collection(COLS.role)
      .findOne({ _id: top._id });
    topRole = {
      role_id: String(top._id),
      name: String(
        roleDoc?.display_name || roleDoc?.name || 'Role',
      ),
      count: top.count,
    };
  }

  const last = permRows[0]?.updatedAt || permRows[0]?.createdAt || null;

  return {
    total: permCount,
    granted_role_count: grouped.length,
    top_role: topRole,
    last_updated_at: last ? new Date(last).toISOString() : null,
  };
}

interface PermissionTypeKpis {
  total: number;
  by_category: { custom: number; builtin: number };
  in_use: number;
  last_updated_at: string | null;
}

/**
 * KPI roll-up for /settings/permission-types. "In use" is the count
 * of distinct permission_type_ids referenced from
 * `crm_permission_role` for this tenant.
 */
export async function getPermissionTypeKpis(): Promise<PermissionTypeKpis> {
  const user = await requireSession();
  if (!user) {
    return {
      total: 0,
      by_category: { custom: 0, builtin: 0 },
      in_use: 0,
      last_updated_at: null,
    };
  }
  const { db } = await connectToDatabase();
  const tenant = new ObjectId(user._id);

  const KNOWN: WsPermissionTypeName[] = [
    'none',
    'all',
    'added',
    'owned',
    'both',
  ];

  const all = (await db
    .collection(COLS.permissionType)
    .find({ userId: tenant })
    .project({ name: 1, updatedAt: 1, createdAt: 1 })
    .toArray()) as Array<{
    _id: ObjectId;
    name?: string;
    updatedAt?: Date;
    createdAt?: Date;
  }>;

  let builtin = 0;
  let custom = 0;
  let latest: Date | null = null;
  for (const row of all) {
    if (KNOWN.includes((row.name || '') as WsPermissionTypeName)) builtin += 1;
    else custom += 1;
    const ts = row.updatedAt || row.createdAt || null;
    if (ts && (!latest || new Date(ts) > latest)) latest = new Date(ts);
  }

  const inUse = await db
    .collection(COLS.permissionRole)
    .distinct('permission_type_id', { userId: tenant });

  return {
    total: all.length,
    by_category: { custom, builtin },
    in_use: inUse.length,
    last_updated_at: latest ? latest.toISOString() : null,
  };
}

interface CustomModuleKpis {
  total: number;
  by_entity_kind: Record<string, number>;
  avg_fields_per_module: number;
  last_updated_at: string | null;
}

/**
 * KPI roll-up for /settings/custom-modules. Buckets by the "table"
 * stem (entity kind), and computes the average number of custom
 * fields registered per module from `crm_custom_fields` (if
 * present), keyed on `entity_kind` or `module_id`.
 */
export async function getCustomModuleKpis(): Promise<CustomModuleKpis> {
  const user = await requireSession();
  if (!user) {
    return {
      total: 0,
      by_entity_kind: {},
      avg_fields_per_module: 0,
      last_updated_at: null,
    };
  }
  const { db } = await connectToDatabase();
  const tenant = new ObjectId(user._id);

  const mods = (await db
    .collection(COLS.customModule)
    .find({ userId: tenant })
    .project({ name: 1, table: 1, updatedAt: 1, createdAt: 1 })
    .toArray()) as Array<{
    _id: ObjectId;
    name?: string;
    table?: string;
    updatedAt?: Date;
    createdAt?: Date;
  }>;

  const byKind: Record<string, number> = {};
  let latest: Date | null = null;
  for (const m of mods) {
    const kind = (m.table || m.name || 'other').split('_')[0] || 'other';
    byKind[kind] = (byKind[kind] || 0) + 1;
    const ts = m.updatedAt || m.createdAt || null;
    if (ts && (!latest || new Date(ts) > latest)) latest = new Date(ts);
  }

  // Average fields per module — count entries in `crm_custom_fields`
  // grouped by `custom_module_id` or `entity_kind`. Falls back to 0 if
  // that collection isn't present yet.
  let avgFields = 0;
  try {
    const fieldsAgg = await db
      .collection('crm_custom_fields')
      .aggregate([
        { $match: { userId: tenant } },
        {
          $group: {
            _id: { $ifNull: ['$custom_module_id', '$entity_kind'] },
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();
    const moduleNames = new Set(mods.map((m) => String(m.name || '')));
    const relevant = fieldsAgg.filter((g: any) => {
      const key = String(g._id ?? '');
      return key && (moduleNames.has(key) || mods.some((m) => String(m._id) === key));
    });
    if (relevant.length > 0) {
      const sum = relevant.reduce((a: number, b: any) => a + b.count, 0);
      avgFields = sum / Math.max(1, mods.length);
    }
  } catch {
    avgFields = 0;
  }

  return {
    total: mods.length,
    by_entity_kind: byKind,
    avg_fields_per_module: Math.round(avgFields * 10) / 10,
    last_updated_at: latest ? latest.toISOString() : null,
  };
}

/* Unused-import guard — keeps tsc happy if an export goes unused. */
void toObjectIdOrNull;
