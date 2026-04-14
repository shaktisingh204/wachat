import type { ObjectId } from 'mongodb';

/**
 * Worksuite RBAC — role, permission, permission-type, module, menu
 * entities ported from the Worksuite PHP/Laravel models:
 *   Role, RoleUser, Permission, PermissionRole, PermissionType,
 *   UserPermission, Module, ModuleSetting, CustomModulePermission, Menu.
 *
 * Multi-tenant: every entity carries `userId` (the tenant admin /
 * company owner) and is scoped via `@/lib/hr-crud`. This RBAC layer
 * lives under CRM settings and is distinct from SabNode's platform
 * RBAC (`src/lib/rbac/`). Collections use the `crm_*` prefix.
 */

export interface WsRbacBase {
  _id?: ObjectId | string;
  /** Tenant owner — the admin/company whose CRM this belongs to. */
  userId: ObjectId | string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Role
 *  Source: Worksuite model `Role`.
 * ══════════════════════════════════════════════════════════════════ */

export interface WsRole extends WsRbacBase {
  /** Slug / programmatic name, e.g. "sales_manager". */
  name: string;
  /** Human label shown in UI. */
  display_name?: string;
  description?: string;
  /** True for the tenant-level "admin" role that has all perms. */
  is_admin?: boolean;
  /** Seeded by the system and cannot be deleted. */
  is_system?: boolean;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Role ↔ User assignment
 *  Source: Worksuite `RoleUser` (pivot).
 * ══════════════════════════════════════════════════════════════════ */

export interface WsRoleUser extends WsRbacBase {
  role_id: ObjectId | string;
  /**
   * Assigned user — either an ObjectId for a full SabNode user or a
   * free-form email / name string for placeholder members. Storing
   * as string keeps the layer flexible while team management matures.
   */
  user_id: string;
  /** Optional denormalised label for fast render. */
  user_name?: string;
  user_email?: string;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Permission
 *  Source: Worksuite model `Permission`.
 * ══════════════════════════════════════════════════════════════════ */

export interface WsPermission extends WsRbacBase {
  /** Slug, e.g. "view_leads". */
  name: string;
  display_name?: string;
  description?: string;
  module_id?: ObjectId | string;
  /** Default permission type (none/all/added/owned/both). */
  type_id?: ObjectId | string;
  /** Whether this is a user-added custom permission vs a seeded one. */
  is_custom?: boolean;
  /** JSON list of types this permission may be granted as. */
  allowed_permissions?: string;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Permission Type
 *  Source: Worksuite model `PermissionType`. Constants (1..5) map to
 *          ADDED / OWNED / BOTH / ALL / NONE — we keep string names.
 * ══════════════════════════════════════════════════════════════════ */

export type WsPermissionTypeName =
  | 'none'
  | 'all'
  | 'added'
  | 'owned'
  | 'both';

export interface WsPermissionType extends WsRbacBase {
  name: WsPermissionTypeName;
  display_name?: string;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Permission ↔ Role assignment
 *  Source: Worksuite `PermissionRole` (pivot with extra type).
 * ══════════════════════════════════════════════════════════════════ */

export interface WsPermissionRole extends WsRbacBase {
  permission_id: ObjectId | string;
  role_id: ObjectId | string;
  permission_type_id: ObjectId | string;
}

/* ═══════════════════════════════════════════════════════════════════
 *  User-level permission override
 *  Source: Worksuite model `UserPermission`.
 * ══════════════════════════════════════════════════════════════════ */

export interface WsUserPermission extends WsRbacBase {
  /** Target user the override applies to. */
  target_user_id: string;
  permission_id: ObjectId | string;
  permission_type_id: ObjectId | string;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Module — feature unit (Leads, Tasks, Projects, …).
 *  Source: Worksuite model `Module`.
 * ══════════════════════════════════════════════════════════════════ */

export interface WsModule extends WsRbacBase {
  module_name: string;
  display_name?: string;
  is_active?: boolean;
  in_menu?: boolean;
  description?: string;
  icon?: string;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Module Setting — per-module toggles (tenant-level).
 *  Source: Worksuite model `ModuleSetting`.
 * ══════════════════════════════════════════════════════════════════ */

export interface WsModuleSetting extends WsRbacBase {
  module_id: ObjectId | string;
  is_allowed?: boolean;
  /** Feature sub-type toggle (e.g. "import", "export"). */
  type?: string;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Custom Module Permission
 *  Source: Worksuite model `CustomModulePermission`.
 * ══════════════════════════════════════════════════════════════════ */

export interface WsCustomModulePermission extends WsRbacBase {
  custom_module_id: ObjectId | string;
  role_id: ObjectId | string;
  can_view?: boolean;
  can_create?: boolean;
  can_edit?: boolean;
  can_delete?: boolean;
}

/** Shape for the custom module definition displayed in the matrix UI. */
export interface WsCustomModule extends WsRbacBase {
  name: string;
  display_name?: string;
  icon?: string;
  /** Underlying collection / table name (informational). */
  table?: string;
  description?: string;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Menu — sidebar entry.
 *  Source: Worksuite model `Menu`.
 * ══════════════════════════════════════════════════════════════════ */

export interface WsMenu extends WsRbacBase {
  label: string;
  route?: string;
  icon?: string;
  parent_id?: ObjectId | string | null;
  position?: number;
  is_visible?: boolean;
}
