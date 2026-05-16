'use server';

/**
 * Department + Designation server actions (Rust-backed).
 *
 * RBAC: every write checks `requirePermission('crm_department' | 'crm_designation', …)`
 * server-side. Reads stay open at the action layer (the route is gated by
 * the dashboard middleware that already checks the page-level permission
 * key), so the UI can render without per-row capability flicker.
 */

import { revalidatePath } from 'next/cache';
import { RustApiError } from '@/lib/rust-client';
import { requirePermission } from '@/lib/rbac-server';
import {
  crmDepartmentsApi,
  crmDesignationsApi,
  type CrmDepartmentCreateInput,
  type CrmDepartmentDoc,
  type CrmDepartmentListParams,
  type CrmDepartmentUpdateInput,
  type CrmDesignationCreateInput,
  type CrmDesignationDoc,
  type CrmDesignationListParams,
  type CrmDesignationUpdateInput,
} from '@/lib/rust-client/crm-departments';

const DEPT_LIST = '/dashboard/crm/hr-payroll/departments/hierarchy';
const DESIG_LIST = '/dashboard/crm/hr-payroll/designations/hierarchy';

function err(e: unknown): string {
  if (e instanceof RustApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Unexpected error.';
}

function pickStr(fd: FormData, k: string): string | undefined {
  const v = fd.get(k);
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length === 0 ? undefined : t;
}

function pickNum(fd: FormData, k: string): number | undefined {
  const v = fd.get(k);
  if (typeof v !== 'string' || v.trim() === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function pickBool(fd: FormData, k: string): boolean | undefined {
  const v = fd.get(k);
  if (v == null) return undefined;
  if (typeof v === 'string') {
    const t = v.trim().toLowerCase();
    if (['true', '1', 'on', 'yes'].includes(t)) return true;
    if (['false', '0', 'off', 'no', ''].includes(t)) return false;
  }
  return undefined;
}

/* ── Departments ──────────────────────────────────────────────── */

export interface DepartmentListResult {
  items: CrmDepartmentDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
  error?: string;
}

export async function listDepartments(
  params: CrmDepartmentListParams = {},
): Promise<DepartmentListResult> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(Math.max(1, params.limit ?? 20), 100);
  try {
    const items = await crmDepartmentsApi.list({ ...params, page, limit });
    return { items, page, limit, hasMore: items.length === limit };
  } catch (e) {
    return { items: [], page, limit, hasMore: false, error: err(e) };
  }
}

export async function getDepartment(id: string): Promise<{ item: CrmDepartmentDoc | null; error?: string }> {
  try {
    return { item: await crmDepartmentsApi.getById(id) };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) return { item: null, error: 'Department not found.' };
    return { item: null, error: err(e) };
  }
}

export async function saveDepartmentAction(
  _prev: unknown,
  fd: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const id = pickStr(fd, '_id');
  const name = pickStr(fd, 'name');
  if (!name) return { error: 'Name is required.' };

  const guard = await requirePermission('crm_department', id ? 'update' : 'create');
  if (!guard.ok) return { error: guard.error };

  const draft: CrmDepartmentCreateInput = {
    name,
    code: pickStr(fd, 'code'),
    parentDepartmentId: pickStr(fd, 'parentDepartmentId'),
    headId: pickStr(fd, 'headId'),
    costCenter: pickStr(fd, 'costCenter'),
    description: pickStr(fd, 'description'),
    active: pickBool(fd, 'active') ?? true,
    color: pickStr(fd, 'color'),
  };

  try {
    const result = id
      ? await crmDepartmentsApi.update(id, draft as CrmDepartmentUpdateInput)
      : await crmDepartmentsApi.create(draft);
    revalidatePath(DEPT_LIST);
    return { message: id ? 'Department updated.' : 'Department created.', id: String(result._id) };
  } catch (e) {
    return { error: err(e) };
  }
}

export async function deleteDepartmentAction(id: string): Promise<{ success: boolean; error?: string }> {
  const guard = await requirePermission('crm_department', 'delete');
  if (!guard.ok) return { success: false, error: guard.error };

  try {
    await crmDepartmentsApi.delete(id);
    revalidatePath(DEPT_LIST);
    return { success: true };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/* ── Designations ─────────────────────────────────────────────── */

export interface DesignationListResult {
  items: CrmDesignationDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
  error?: string;
}

export async function listDesignations(
  params: CrmDesignationListParams = {},
): Promise<DesignationListResult> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(Math.max(1, params.limit ?? 20), 100);
  try {
    const items = await crmDesignationsApi.list({ ...params, page, limit });
    return { items, page, limit, hasMore: items.length === limit };
  } catch (e) {
    return { items: [], page, limit, hasMore: false, error: err(e) };
  }
}

export async function getDesignation(id: string): Promise<{ item: CrmDesignationDoc | null; error?: string }> {
  try {
    return { item: await crmDesignationsApi.getById(id) };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) return { item: null, error: 'Designation not found.' };
    return { item: null, error: err(e) };
  }
}

export async function saveDesignationAction(
  _prev: unknown,
  fd: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const id = pickStr(fd, '_id');
  const name = pickStr(fd, 'name');
  if (!name) return { error: 'Name is required.' };

  const guard = await requirePermission('crm_designation', id ? 'update' : 'create');
  if (!guard.ok) return { error: guard.error };

  const draft: CrmDesignationCreateInput = {
    name,
    code: pickStr(fd, 'code'),
    departmentId: pickStr(fd, 'departmentId'),
    level: pickNum(fd, 'level'),
    grade: pickStr(fd, 'grade'),
    minCtc: pickNum(fd, 'minCtc'),
    maxCtc: pickNum(fd, 'maxCtc'),
    reportsToDesignationId: pickStr(fd, 'reportsToDesignationId'),
    description: pickStr(fd, 'description'),
    active: pickBool(fd, 'active') ?? true,
    color: pickStr(fd, 'color'),
  };

  try {
    const result = id
      ? await crmDesignationsApi.update(id, draft as CrmDesignationUpdateInput)
      : await crmDesignationsApi.create(draft);
    revalidatePath(DESIG_LIST);
    return { message: id ? 'Designation updated.' : 'Designation created.', id: String(result._id) };
  } catch (e) {
    return { error: err(e) };
  }
}

export async function deleteDesignationAction(id: string): Promise<{ success: boolean; error?: string }> {
  const guard = await requirePermission('crm_designation', 'delete');
  if (!guard.ok) return { success: false, error: guard.error };

  try {
    await crmDesignationsApi.delete(id);
    revalidatePath(DESIG_LIST);
    return { success: true };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}
