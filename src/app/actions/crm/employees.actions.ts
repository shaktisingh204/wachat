'use server';

/**
 * CRM Employee server actions.
 *
 * Thin shims over the Rust BFF (`crmEmployeesApi`). No direct Mongo
 * access. FormData callers (the form pages) hit `saveEmployeeAction` /
 * `deleteEmployeeAction`; programmatic callers can use the typed
 * helpers (`listEmployees`, `getEmployee`, `createEmployee`,
 * `updateEmployee`, `deleteEmployee`).
 */

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { RustApiError } from '@/lib/rust-client';
import { requirePermission } from '@/lib/rbac-server';
import {
  crmEmployeesApi,
  type CrmEmployeeCreateInput,
  type CrmEmployeeDoc,
  type CrmEmployeeGender,
  type CrmEmployeeListParams,
  type CrmEmployeeStatus,
  type CrmEmployeeType,
  type CrmEmployeeUpdateInput,
} from '@/lib/rust-client/crm-employees';
import { applyCustomFieldsToEntity } from '@/app/actions/worksuite/meta.actions';

const LIST_PATH = '/dashboard/crm/hr-payroll/employees';

function rustErr(e: unknown): string {
  if (e instanceof RustApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Unexpected error.';
}

/* ─── Read ────────────────────────────────────────────────────── */

export interface EmployeeListResult {
  employees: CrmEmployeeDoc[];
  page: number;
  limit: number;
  // The Rust endpoint returns a bare array — there's no `total` field.
  // The UI uses `hasMore` to know whether to render the Next button.
  hasMore: boolean;
  error?: string;
}

export async function listEmployees(
  params: CrmEmployeeListParams = {},
): Promise<EmployeeListResult> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(Math.max(1, params.limit ?? 20), 100);
  try {
    const employees = await crmEmployeesApi.list({ ...params, page, limit });
    return { employees, page, limit, hasMore: employees.length === limit };
  } catch (e) {
    return { employees: [], page, limit, hasMore: false, error: rustErr(e) };
  }
}

export async function getEmployee(
  id: string,
): Promise<{ employee: CrmEmployeeDoc | null; error?: string }> {
  if (!id) return { employee: null, error: 'Missing employee id.' };
  try {
    const employee = await crmEmployeesApi.getById(id);
    return { employee };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { employee: null, error: 'Employee not found.' };
    }
    return { employee: null, error: rustErr(e) };
  }
}

/* ─── Write ───────────────────────────────────────────────────── */

function pickString(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length === 0 ? undefined : t;
}

function pickNumber(formData: FormData, key: string): number | undefined {
  const v = formData.get(key);
  if (typeof v !== 'string' || v.trim() === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** Coerce a wire-format gender string into the typed union or `undefined`. */
function pickGender(formData: FormData): CrmEmployeeGender | undefined {
  const v = pickString(formData, 'gender');
  if (!v) return undefined;
  return (
    ['male', 'female', 'non_binary', 'other', 'prefer_not_to_say'] as const
  ).includes(v as CrmEmployeeGender)
    ? (v as CrmEmployeeGender)
    : undefined;
}

/** Coerce a wire-format status string into the typed union or `undefined`. */
function pickStatus(formData: FormData): CrmEmployeeStatus | undefined {
  const v = pickString(formData, 'status');
  if (!v) return undefined;
  return (['active', 'on_leave', 'terminated', 'resigned'] as const).includes(
    v as CrmEmployeeStatus,
  )
    ? (v as CrmEmployeeStatus)
    : undefined;
}

/** Coerce a wire-format employmentType string into the typed union. */
function pickEmploymentType(formData: FormData): CrmEmployeeType | undefined {
  const v = pickString(formData, 'employmentType');
  if (!v) return undefined;
  return (
    ['full_time', 'part_time', 'contract', 'intern', 'consultant'] as const
  ).includes(v as CrmEmployeeType)
    ? (v as CrmEmployeeType)
    : undefined;
}

function parseCustomFields(formData: FormData): Record<string, unknown> | null {
  const raw = formData.get('customFields');
  if (typeof raw !== 'string' || raw.length === 0 || raw === '{}') return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Server-action entry point for the create / edit form.
 *
 * If `formData` carries an `_id`, this performs a PATCH; otherwise a
 * POST. Custom-field values (under the `customFields` JSON blob) are
 * persisted via `applyCustomFieldsToEntity` after the main row is
 * created/updated — failures there are logged but do not roll back the
 * employee save.
 */
export async function saveEmployeeAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const id = pickString(formData, '_id');
  const firstName = pickString(formData, 'firstName');
  const lastName = pickString(formData, 'lastName');

  if (!firstName || !lastName) {
    return { error: 'First name and last name are required.' };
  }

  const guard = await requirePermission('crm_employee', id ? 'edit' : 'create');
  if (!guard.ok) return { error: guard.error };

  // Create path — Rust enforces dob / joiningDate / departmentId /
  // designationId / workEmail / salaryStructureId as required.
  const isCreate = !id;
  const dob = pickString(formData, 'dob');
  const joiningDate = pickString(formData, 'joiningDate');
  const departmentId = pickString(formData, 'departmentId');
  const designationId = pickString(formData, 'designationId');
  const workEmail = pickString(formData, 'workEmail');
  const salaryStructureId = pickString(formData, 'salaryStructureId');

  if (isCreate) {
    const missing: string[] = [];
    if (!dob) missing.push('Date of birth');
    if (!joiningDate) missing.push('Joining date');
    if (!departmentId) missing.push('Department');
    if (!designationId) missing.push('Designation');
    if (!workEmail) missing.push('Work email');
    if (!salaryStructureId) missing.push('Salary structure');
    if (missing.length > 0) {
      return { error: `Missing required field(s): ${missing.join(', ')}.` };
    }
  }

  // Normalize dates to full ISO so chrono accepts them server-side. The
  // browser <input type="date"> ships `YYYY-MM-DD`, which chrono refuses
  // without an explicit time zone.
  const toIso = (v?: string): string | undefined => {
    if (!v) return undefined;
    if (v.length === 10) return `${v}T00:00:00Z`;
    return v;
  };

  try {
    let result: CrmEmployeeDoc;
    if (id) {
      const patch: CrmEmployeeUpdateInput = {
        firstName,
        lastName,
        displayName: pickString(formData, 'displayName'),
        salutation: pickString(formData, 'salutation'),
        dob: toIso(dob),
        gender: pickGender(formData),
        personalEmail: pickString(formData, 'personalEmail'),
        personalPhone: pickString(formData, 'personalPhone'),
        workEmail: pickString(formData, 'workEmail'),
        workPhone: pickString(formData, 'workPhone'),
        joiningDate: toIso(joiningDate),
        departmentId,
        designationId,
        salaryStructureId,
        employmentType: pickEmploymentType(formData),
        reportingManagerId: pickString(formData, 'reportingManagerId'),
        dottedLineManagerId: pickString(formData, 'dottedLineManagerId'),
        ctc: pickNumber(formData, 'ctc'),
        variablePct: pickNumber(formData, 'variablePct'),
        noticePeriodDays: pickNumber(formData, 'noticePeriodDays'),
        status: pickStatus(formData),
      };
      result = await crmEmployeesApi.update(id, patch);
    } else {
      const draft: CrmEmployeeCreateInput = {
        firstName,
        lastName,
        dob: toIso(dob)!,
        joiningDate: toIso(joiningDate)!,
        departmentId: departmentId!,
        designationId: designationId!,
        workEmail: workEmail!,
        salaryStructureId: salaryStructureId!,
        displayName: pickString(formData, 'displayName'),
        salutation: pickString(formData, 'salutation'),
        gender: pickGender(formData),
        personalEmail: pickString(formData, 'personalEmail'),
        personalPhone: pickString(formData, 'personalPhone'),
        workPhone: pickString(formData, 'workPhone'),
        employmentType: pickEmploymentType(formData),
        reportingManagerId: pickString(formData, 'reportingManagerId'),
        dottedLineManagerId: pickString(formData, 'dottedLineManagerId'),
        ctc: pickNumber(formData, 'ctc'),
        variablePct: pickNumber(formData, 'variablePct'),
        noticePeriodDays: pickNumber(formData, 'noticePeriodDays'),
        status: pickStatus(formData),
      };
      result = await crmEmployeesApi.create(draft);
    }

    const cfValues = parseCustomFields(formData);
    if (cfValues && result._id) {
      try {
        await applyCustomFieldsToEntity('employee', String(result._id), cfValues);
      } catch (e) {
        console.error('[saveEmployeeAction] custom fields apply failed:', e);
      }
    }

    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${String(result._id)}`);
    return {
      message: id ? 'Employee updated.' : 'Employee created.',
      id: String(result._id),
    };
  } catch (e) {
    return { error: rustErr(e) };
  }
}

/**
 * Hard-delete an employee. The Rust handler removes the row from the
 * collection — no soft-delete flag.
 */
export async function deleteEmployeeAction(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  if (!id) return { success: false, error: 'Missing employee id.' };

  const guard = await requirePermission('crm_employee', 'delete');
  if (!guard.ok) return { success: false, error: guard.error };

  try {
    await crmEmployeesApi.delete(id);
    revalidatePath(LIST_PATH);
    return { success: true };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { success: false, error: 'Employee not found.' };
    }
    return { success: false, error: rustErr(e) };
  }
}

/* ─── Programmatic helpers (typed) ────────────────────────────── */
//
// 'use server' files only allow async exports — these helpers thinly
// wrap the Rust client so callers don't have to remember `await
// crmEmployeesApi.x(...)`.

export async function createEmployee(input: CrmEmployeeCreateInput) {
  return crmEmployeesApi.create(input);
}

export async function updateEmployee(id: string, patch: CrmEmployeeUpdateInput) {
  return crmEmployeesApi.update(id, patch);
}

export async function deleteEmployee(id: string) {
  return crmEmployeesApi.delete(id);
}

/* ─── getCrmEmployeeRelatedCounts ───────────────────────────────────────
 * Right-rail counts (§5.6) for the employee detail page. Tasks, leaves,
 * attendance, documents, assigned assets, and payslips for this
 * employee — all tenant-scoped on `userId`. Returns zeros on any
 * failure so the UI never blocks.
 */
export async function getCrmEmployeeRelatedCounts(employeeId: string): Promise<{
  tasks: number;
  leaves: number;
  attendance: number;
  documents: number;
  assets: number;
  payslips: number;
}> {
  const empty = {
    tasks: 0,
    leaves: 0,
    attendance: 0,
    documents: 0,
    assets: 0,
    payslips: 0,
  };
  if (!employeeId) return empty;
  const session = await getSession();
  if (!session?.user) return empty;

  try {
    const { db } = await connectToDatabase();
    const userId = new ObjectId(String(session.user._id));
    const idCandidates: unknown[] = [employeeId];
    if (ObjectId.isValid(employeeId)) idCandidates.push(new ObjectId(employeeId));

    const [tasks, leaves, attendance, documents, assets, payslips] = await Promise.all([
      db
        .collection('crm_tasks')
        .countDocuments({
          userId,
          $or: [
            { assigneeId: { $in: idCandidates } },
            { employeeId: { $in: idCandidates } },
          ],
        } as Record<string, unknown>)
        .catch(() => 0),
      db
        .collection('crm_leaves')
        .countDocuments({
          userId,
          employeeId: { $in: idCandidates },
        } as Record<string, unknown>)
        .catch(() => 0),
      db
        .collection('crm_attendance')
        .countDocuments({
          userId,
          employeeId: { $in: idCandidates },
        } as Record<string, unknown>)
        .catch(() => 0),
      db
        .collection('crm_hr_documents')
        .countDocuments({
          userId,
          employeeId: { $in: idCandidates },
        } as Record<string, unknown>)
        .catch(() => 0),
      db
        .collection('crm_asset_assignments')
        .countDocuments({
          userId,
          employeeId: { $in: idCandidates },
        } as Record<string, unknown>)
        .catch(() => 0),
      db
        .collection('crm_payslips')
        .countDocuments({
          userId,
          employeeId: { $in: idCandidates },
        } as Record<string, unknown>)
        .catch(() => 0),
    ]);

    return {
      tasks: Number(tasks) || 0,
      leaves: Number(leaves) || 0,
      attendance: Number(attendance) || 0,
      documents: Number(documents) || 0,
      assets: Number(assets) || 0,
      payslips: Number(payslips) || 0,
    };
  } catch (e) {
    console.error('[getCrmEmployeeRelatedCounts] failed:', e);
    return empty;
  }
}

/* ─── Aliases for §1D parity ─── */
export const getEmployeeRelatedCounts = getCrmEmployeeRelatedCounts;

/* ─── KPI snapshot ───────────────────────────────────────────────
 * Aggregates a window of employees (capped at 500 — the Rust endpoint
 * enforces its own upper bound) into the §1D KPI vocabulary:
 *   - total, active, onLeave, onNotice, newThisMonth, terminated
 *
 * `onNotice` is approximated from `status === 'resigned'` (notice
 * period in progress) — once the Rust DTO exposes a dedicated flag
 * we will swap this branch over. */
export interface EmployeeKpiBundle {
  total: number;
  active: number;
  onLeave: number;
  onNotice: number;
  newThisMonth: number;
  terminated: number;
  avgTenureMonths: number | null;
}

export async function getEmployeeKpis(): Promise<EmployeeKpiBundle> {
  const empty: EmployeeKpiBundle = {
    total: 0,
    active: 0,
    onLeave: 0,
    onNotice: 0,
    newThisMonth: 0,
    terminated: 0,
    avgTenureMonths: null,
  };
  try {
    const docs = await crmEmployeesApi.list({ page: 1, limit: 500 });
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    let total = 0;
    let active = 0;
    let onLeave = 0;
    let onNotice = 0;
    let newThisMonth = 0;
    let terminated = 0;
    let tenureSum = 0;
    let tenureCount = 0;
    for (const e of docs) {
      if (e.archived) continue;
      total += 1;
      const status = e.status;
      if (status === 'active') {
        active += 1;
        if (e.joiningDate) {
          const t = new Date(e.joiningDate).getTime();
          if (Number.isFinite(t) && t <= now.getTime()) {
            const months =
              (now.getTime() - t) / (1000 * 60 * 60 * 24 * 30.4375);
            if (Number.isFinite(months) && months >= 0) {
              tenureSum += months;
              tenureCount += 1;
            }
          }
        }
      } else if (status === 'on_leave') {
        onLeave += 1;
      } else if (status === 'resigned') {
        onNotice += 1;
      } else if (status === 'terminated') {
        terminated += 1;
      }
      if (e.joiningDate) {
        const t = new Date(e.joiningDate).getTime();
        if (Number.isFinite(t) && t >= monthStart) {
          newThisMonth += 1;
        }
      }
    }
    return {
      total,
      active,
      onLeave,
      onNotice,
      newThisMonth,
      terminated,
      avgTenureMonths:
        tenureCount > 0
          ? Math.round((tenureSum / tenureCount) * 10) / 10
          : null,
    };
  } catch (e) {
    console.error('[getEmployeeKpis] failed:', e);
    return empty;
  }
}

/* ─── Bulk status mutation ───────────────────────────────────────
 * `setEmployeeStatus` flips one or more employees to the supplied
 * status atomically per-row via the Rust PATCH endpoint. RBAC is
 * enforced once at the start; per-row errors are accumulated and
 * returned so the UI can surface partial failures. */
export async function setEmployeeStatus(
  ids: string[],
  status: CrmEmployeeStatus,
): Promise<{ ok: number; failed: number; errors: string[] }> {
  if (!ids?.length) return { ok: 0, failed: 0, errors: [] };
  const guard = await requirePermission('crm_employee', 'edit');
  if (!guard.ok) return { ok: 0, failed: ids.length, errors: [guard.error ?? 'Forbidden'] };

  let ok = 0;
  let failed = 0;
  const errors: string[] = [];
  for (const id of ids) {
    try {
      await crmEmployeesApi.update(id, { status });
      ok += 1;
    } catch (e) {
      failed += 1;
      errors.push(`${id}: ${rustErr(e)}`);
    }
  }
  revalidatePath(LIST_PATH);
  revalidatePath('/dashboard/hrm/payroll/employees');
  return { ok, failed, errors };
}
