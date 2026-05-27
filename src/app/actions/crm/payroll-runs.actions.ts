'use server';

/**
 * CRM Payroll Run server actions.
 *
 * Thin shims over the Rust BFF (`crmPayrollRunsApi`). No direct Mongo
 * access. FormData callers (the form pages) hit `savePayrollRunAction`
 * / `deletePayrollRunAction`; programmatic callers can use the typed
 * helpers (`listPayrollRuns`, `getPayrollRun`).
 *
 * Custom fields are intentionally **NOT** supported — `'payrollRun'` is
 * not registered as a `WsCustomFieldBelongsTo` target.
 *
 * Plus three lifecycle actions wrapping the §9.6 workflow endpoints:
 * `computePayrollRunAction`, `approvePayrollRunAction`,
 * `disbursePayrollRunAction`.
 */

import { revalidatePath } from 'next/cache';
import { getSession } from '@/app/actions/user.actions';
import { writeAuditEntry } from '@/lib/audit-log';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { requirePermission } from '@/lib/rbac-server';
import { RustApiError } from '@/lib/rust-client';
import {
  crmPayrollRunsApi,
  type CrmPayrollRunCreateInput,
  type CrmPayrollRunDoc,
  type CrmPayrollRunListParams,
  type CrmPayrollRunUpdateInput,
} from '@/lib/rust-client/crm-payroll-runs';

const LIST_PATH = '/dashboard/crm/hr-payroll/payroll';

function rustErr(e: unknown): string {
  if (e instanceof RustApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Unexpected error.';
}

/* ─── Read ────────────────────────────────────────────────────── */

interface PayrollRunListResult {
  runs: CrmPayrollRunDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
  error?: string;
}

export async function listPayrollRuns(
  params: CrmPayrollRunListParams = {},
): Promise<PayrollRunListResult> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(Math.max(1, params.limit ?? 20), 100);
  const session = await getSession();
  if (!session?.user) return { runs: [], page, limit, hasMore: false, error: 'Unauthorized' };
  const guard = await requirePermission('crm_payroll', 'view');
  if (!guard.ok) return { runs: [], page, limit, hasMore: false, error: guard.error };
  try {
    const runs = await crmPayrollRunsApi.list({ ...params, page, limit });
    return { runs, page, limit, hasMore: runs.length === limit };
  } catch (e) {
    console.error('[listPayrollRuns] rust path failed; falling back:', e);
    recordRustFallback({ entity: 'payroll_run', op: 'list', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
    return { runs: [], page, limit, hasMore: false, error: rustErr(e) };
  }
}

export async function getPayrollRun(
  id: string,
): Promise<{ run: CrmPayrollRunDoc | null; error?: string }> {
  if (!id) return { run: null, error: 'Missing payroll run id.' };
  const session = await getSession();
  if (!session?.user) return { run: null, error: 'Unauthorized' };
  const guard = await requirePermission('crm_payroll', 'view');
  if (!guard.ok) return { run: null, error: guard.error };
  try {
    const run = await crmPayrollRunsApi.getById(id);
    return { run };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { run: null, error: 'Payroll run not found.' };
    }
    console.error('[getPayrollRun] rust path failed; falling back:', e);
    recordRustFallback({ entity: 'payroll_run', op: 'get', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
    return { run: null, error: rustErr(e) };
  }
}

/* ─── Write ───────────────────────────────────────────────────── */

function pickString(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length === 0 ? undefined : t;
}

function pickDate(formData: FormData, key: string): string | undefined {
  // The form's <input type="date"> yields `YYYY-MM-DD`; the Rust DTO
  // expects an RFC3339 timestamp, so we widen to midnight UTC.
  const raw = pickString(formData, key);
  if (!raw) return undefined;
  // Already ISO with time component — pass through unchanged.
  if (raw.includes('T')) return raw;
  return `${raw}T00:00:00Z`;
}

/**
 * Server-action entry point for the create / edit form.
 *
 * If `formData` carries an `_id`, this performs a PATCH; otherwise a
 * POST. `periodFrom` and `periodTo` are required for create.
 */
export async function savePayrollRunAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const session = await getSession();
  if (!session?.user) return { error: 'Unauthorized' };

  const id = pickString(formData, '_id');
  const guard = await requirePermission('crm_payroll', id ? 'edit' : 'create');
  if (!guard.ok) return { error: guard.error };

  const periodFrom = pickDate(formData, 'periodFrom');
  const periodTo = pickDate(formData, 'periodTo');

  if (!id) {
    if (!periodFrom || !periodTo) {
      return { error: 'Period start and period end are required.' };
    }
  }

  if (periodFrom && periodTo && new Date(periodTo) < new Date(periodFrom)) {
    return { error: 'Period end must be on or after period start.' };
  }

  try {
    let result: CrmPayrollRunDoc;
    if (id) {
      const patch: CrmPayrollRunUpdateInput = {
        periodFrom,
        periodTo,
        payDate: pickDate(formData, 'payDate'),
        lockDate: pickDate(formData, 'lockDate'),
        bankFileFormat: pickString(formData, 'bankFileFormat'),
      };
      result = await crmPayrollRunsApi.update(id, patch);
    } else {
      const draft: CrmPayrollRunCreateInput = {
        periodFrom: periodFrom as string,
        periodTo: periodTo as string,
        payDate: pickDate(formData, 'payDate'),
        lockDate: pickDate(formData, 'lockDate'),
        bankFileFormat: pickString(formData, 'bankFileFormat'),
      };
      result = await crmPayrollRunsApi.create(draft);
    }

    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: id ? 'update' : 'create',
        entityKind: 'payroll_run',
        entityId: String(result._id),
      });
    } catch {
      /* non-fatal */
    }

    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${String(result._id)}`);
    return {
      message: id ? 'Payroll run updated.' : 'Payroll run created.',
      id: String(result._id),
    };
  } catch (e) {
    console.error('[savePayrollRunAction] rust path failed; falling back:', e);
    recordRustFallback({ entity: 'payroll_run', op: id ? 'update' : 'create', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
    return { error: rustErr(e) };
  }
}

/**
 * Hard-delete a payroll run. The Rust handler removes the row from the
 * collection.
 */
export async function deletePayrollRunAction(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  if (!id) return { success: false, error: 'Missing payroll run id.' };
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Unauthorized' };
  const guard = await requirePermission('crm_payroll', 'delete');
  if (!guard.ok) return { success: false, error: guard.error };
  try {
    await crmPayrollRunsApi.delete(id);
    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: 'delete',
        entityKind: 'payroll_run',
        entityId: id,
      });
    } catch {
      /* non-fatal */
    }
    revalidatePath(LIST_PATH);
    return { success: true };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { success: false, error: 'Payroll run not found.' };
    }
    console.error('[deletePayrollRunAction] rust path failed; falling back:', e);
    recordRustFallback({ entity: 'payroll_run', op: 'delete', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
    return { success: false, error: rustErr(e) };
  }
}

/* ─── Lifecycle actions ───────────────────────────────────────── */

export async function computePayrollRunAction(
  id: string,
): Promise<{ success: boolean; message?: string; error?: string }> {
  if (!id) return { success: false, error: 'Missing payroll run id.' };
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Unauthorized' };
  const guard = await requirePermission('crm_payroll', 'edit');
  if (!guard.ok) return { success: false, error: guard.error };
  try {
    const run = await crmPayrollRunsApi.compute(id);
    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: 'compute',
        entityKind: 'payroll_run',
        entityId: id,
      });
    } catch {
      /* non-fatal */
    }
    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${String(run._id)}`);
    return { success: true, message: 'Payroll computed.' };
  } catch (e) {
    console.error('[computePayrollRunAction] rust path failed; falling back:', e);
    recordRustFallback({ entity: 'payroll_run', op: 'other', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
    return { success: false, error: rustErr(e) };
  }
}

export async function approvePayrollRunAction(
  id: string,
  input: { approverId: string; comment?: string },
): Promise<{ success: boolean; message?: string; error?: string }> {
  if (!id) return { success: false, error: 'Missing payroll run id.' };
  if (!input?.approverId) {
    return { success: false, error: 'Approver is required.' };
  }
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Unauthorized' };
  const guard = await requirePermission('crm_payroll', 'edit');
  if (!guard.ok) return { success: false, error: guard.error };
  try {
    const run = await crmPayrollRunsApi.approve(id, {
      approverId: input.approverId,
      comment: input.comment,
    });
    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: 'approve',
        entityKind: 'payroll_run',
        entityId: id,
        reason: input.comment,
      });
    } catch {
      /* non-fatal */
    }
    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${String(run._id)}`);
    return { success: true, message: 'Payroll approved.' };
  } catch (e) {
    console.error('[approvePayrollRunAction] rust path failed; falling back:', e);
    recordRustFallback({ entity: 'payroll_run', op: 'other', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
    return { success: false, error: rustErr(e) };
  }
}

export async function disbursePayrollRunAction(
  id: string,
): Promise<{ success: boolean; message?: string; error?: string }> {
  if (!id) return { success: false, error: 'Missing payroll run id.' };
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Unauthorized' };
  const guard = await requirePermission('crm_payroll', 'edit');
  if (!guard.ok) return { success: false, error: guard.error };
  try {
    const run = await crmPayrollRunsApi.disburse(id);
    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: 'disburse',
        entityKind: 'payroll_run',
        entityId: id,
      });
    } catch {
      /* non-fatal */
    }
    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${String(run._id)}`);
    return { success: true, message: 'Payroll disbursed.' };
  } catch (e) {
    console.error('[disbursePayrollRunAction] rust path failed; falling back:', e);
    recordRustFallback({ entity: 'payroll_run', op: 'other', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
    return { success: false, error: rustErr(e) };
  }
}

/* ─── Programmatic helpers (typed) ────────────────────────────── */

export async function createPayrollRun(input: CrmPayrollRunCreateInput) {
  return crmPayrollRunsApi.create(input);
}

export async function updatePayrollRun(
  id: string,
  patch: CrmPayrollRunUpdateInput,
) {
  return crmPayrollRunsApi.update(id, patch);
}

export async function deletePayrollRun(id: string) {
  return crmPayrollRunsApi.delete(id);
}
