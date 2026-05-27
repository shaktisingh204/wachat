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

interface DepartmentListResult {
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

  const guard = await requirePermission('crm_department', id ? 'edit' : 'create');
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

interface DesignationListResult {
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

  const guard = await requirePermission('crm_designation', id ? 'edit' : 'create');
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

/* ── KPI snapshots (§1D) ───────────────────────────────────────── */

interface DepartmentKpiBundle {
  total: number;
  active: number;
  inactive: number;
  /** Headcount in the largest department. */
  largestHeadcount: number;
  /** Rounded to 1 decimal — useful for the "Avg headcount" tile. */
  avgHeadcount: number;
}

export async function getDepartmentKpis(): Promise<DepartmentKpiBundle> {
  const empty: DepartmentKpiBundle = {
    total: 0,
    active: 0,
    inactive: 0,
    largestHeadcount: 0,
    avgHeadcount: 0,
  };
  try {
    const [departments, { listEmployees }] = await Promise.all([
      crmDepartmentsApi.list({ page: 1, limit: 200 }),
      import('@/app/actions/crm/employees.actions'),
    ]);
    if (departments.length === 0) return empty;
    const counts = await Promise.all(
      departments.map((d) =>
        listEmployees({ departmentId: d._id, limit: 1 })
          // The Rust list endpoint returns up to `limit` items and a
          // hasMore flag — for an accurate headcount we'd need a
          // `count` endpoint. Until that lands we pull a wider window
          // for any department that hit the cap.
          .then(async (res) => {
            if (!res.hasMore) return res.employees.length;
            const wider = await listEmployees({
              departmentId: d._id,
              limit: 100,
            });
            return wider.employees.length + (wider.hasMore ? 1 : 0);
          })
          .catch(() => 0),
      ),
    );
    const total = departments.length;
    const active = departments.filter((d) => d.active !== false).length;
    const inactive = total - active;
    const largest = counts.length > 0 ? Math.max(...counts) : 0;
    const sum = counts.reduce((a, b) => a + b, 0);
    const avg = total > 0 ? Math.round((sum / total) * 10) / 10 : 0;
    return { total, active, inactive, largestHeadcount: largest, avgHeadcount: avg };
  } catch (e) {
    console.error('[getDepartmentKpis] failed:', e);
    return empty;
  }
}

interface DesignationKpiBundle {
  total: number;
  active: number;
  inactive: number;
  /** Holders in the most-populated designation. */
  topHeadcount: number;
  /** Name of that designation (for the "Top by headcount" tile). */
  topName: string | null;
}

export async function getDesignationKpis(): Promise<DesignationKpiBundle> {
  const empty: DesignationKpiBundle = {
    total: 0,
    active: 0,
    inactive: 0,
    topHeadcount: 0,
    topName: null,
  };
  try {
    const [designations, { listEmployees }] = await Promise.all([
      crmDesignationsApi.list({ page: 1, limit: 200 }),
      import('@/app/actions/crm/employees.actions'),
    ]);
    if (designations.length === 0) return empty;
    const counts = await Promise.all(
      designations.map((d) =>
        listEmployees({ designationId: d._id, limit: 1 })
          .then(async (res) => {
            if (!res.hasMore) return res.employees.length;
            const wider = await listEmployees({
              designationId: d._id,
              limit: 100,
            });
            return wider.employees.length + (wider.hasMore ? 1 : 0);
          })
          .catch(() => 0),
      ),
    );
    const total = designations.length;
    const active = designations.filter((d) => d.active !== false).length;
    const inactive = total - active;
    let topIdx = -1;
    let topHeadcount = 0;
    counts.forEach((c, i) => {
      if (c > topHeadcount) {
        topHeadcount = c;
        topIdx = i;
      }
    });
    return {
      total,
      active,
      inactive,
      topHeadcount,
      topName: topIdx >= 0 ? designations[topIdx].name : null,
    };
  } catch (e) {
    console.error('[getDesignationKpis] failed:', e);
    return empty;
  }
}

/* ── Related counts (§1D) ─────────────────────────────────────── */

export async function getDepartmentRelatedCounts(id: string): Promise<{
  employees: number;
  children: number;
}> {
  const empty = { employees: 0, children: 0 };
  if (!id) return empty;
  try {
    const { listEmployees } = await import('@/app/actions/crm/employees.actions');
    const [{ employees, hasMore }, { items: allDepartments }] = await Promise.all([
      listEmployees({ departmentId: id, limit: 100 }),
      listDepartments({ limit: 200 }),
    ]);
    return {
      employees: employees.length + (hasMore ? 1 : 0),
      children: allDepartments.filter((d) => d.parentDepartmentId === id).length,
    };
  } catch (e) {
    console.error('[getDepartmentRelatedCounts] failed:', e);
    return empty;
  }
}

export async function getDesignationRelatedCounts(id: string): Promise<{
  employees: number;
}> {
  if (!id) return { employees: 0 };
  try {
    const { listEmployees } = await import('@/app/actions/crm/employees.actions');
    const { employees, hasMore } = await listEmployees({
      designationId: id,
      limit: 100,
    });
    return { employees: employees.length + (hasMore ? 1 : 0) };
  } catch (e) {
    console.error('[getDesignationRelatedCounts] failed:', e);
    return { employees: 0 };
  }
}
