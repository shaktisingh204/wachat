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
import { RustApiError } from '@/lib/rust-client';
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
