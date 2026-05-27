/**
 * Types extracted from hrm-permission-groups.actions.ts
 * to avoid Turbopack 'use server' export restrictions.
 */

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete';

export interface ModulePermission {
  module: string;
  actions: PermissionAction[];
}

export interface HrmPermissionGroup {
  _id: string;
  userId: string;
  name: string;
  description?: string;
  permissions: ModulePermission[];
  createdAt: string;
  updatedAt: string;
}
