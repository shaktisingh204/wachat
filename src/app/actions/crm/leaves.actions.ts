'use server';

/**
 * CRM Leave-Application server actions.
 *
 * Thin shims over the Rust BFF (`crmLeavesApi`). No direct Mongo
 * access. FormData callers (the list / form pages) hit
 * `saveLeaveAction` / `deleteLeaveAction`; programmatic callers can use
 * the typed helpers (`listLeaves`, `getLeave`, `createLeave`,
 * `updateLeave`, `deleteLeave`).
 *
 * Note: per the Rust DTO, `status` is NOT patchable here — workflow
 * transitions go through dedicated approve / reject / cancel actions
 * upstream. Custom fields are also skipped: `'leave'` is not a
 * registered `WsCustomFieldBelongsTo` value.
 */

import { revalidatePath } from 'next/cache';
import { getSession } from '@/app/actions/user.actions';
import { writeAuditEntry } from '@/lib/audit-log';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { requirePermission } from '@/lib/rbac-server';
import { RustApiError } from '@/lib/rust-client';
import {
  crmLeavesApi,
  crmLeaveTypesApi,
  type CrmLeaveCreateInput,
  type CrmLeaveDoc,
  type CrmLeaveListParams,
  type CrmLeaveTypeOption,
  type CrmLeaveUpdateInput,
} from '@/lib/rust-client/crm-leaves';

const LIST_PATH = '/dashboard/crm/hr-payroll/leave';

function useRustCrm(): boolean {
  return process.env.USE_RUST_CRM === 'true';
}

function rustErr(e: unknown): string {
  if (e instanceof RustApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Unexpected error.';
}

/* ─── Read ────────────────────────────────────────────────────── */

export interface LeaveListResult {
  leaves: CrmLeaveDoc[];
  page: number;
  limit: number;
  /**
   * The Rust endpoint returns a bare array — there's no `total` field.
   * The UI uses `hasMore` to know whether to render the Next button.
   */
  hasMore: boolean;
  error?: string;
}

export async function listLeaves(params: CrmLeaveListParams = {}): Promise<LeaveListResult> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(Math.max(1, params.limit ?? 20), 100);
  try {
    const leaves = await crmLeavesApi.list({ ...params, page, limit });
    return { leaves, page, limit, hasMore: leaves.length === limit };
  } catch (e) {
    recordRustFallback({ entity: 'leave', op: 'list', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
    return { leaves: [], page, limit, hasMore: false, error: rustErr(e) };
  }
}

export async function getLeave(
  id: string,
): Promise<{ leave: CrmLeaveDoc | null; error?: string }> {
  if (!id) return { leave: null, error: 'Missing leave id.' };
  try {
    const leave = await crmLeavesApi.getById(id);
    return { leave };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { leave: null, error: 'Leave not found.' };
    }
    recordRustFallback({ entity: 'leave', op: 'get', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
    return { leave: null, error: rustErr(e) };
  }
}

/* ─── Write ───────────────────────────────────────────────────── */

function pickString(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length === 0 ? undefined : t;
}

function pickBool(formData: FormData, key: string): boolean | undefined {
  const v = formData.get(key);
  if (typeof v !== 'string') return undefined;
  if (v === 'true' || v === 'on' || v === '1') return true;
  if (v === 'false' || v === 'off' || v === '0' || v === '') return false;
  return undefined;
}

/**
 * Convert a `YYYY-MM-DD` (or full ISO) date string into a fully-
 * qualified ISO 8601 instant that the Rust DTO can deserialize via
 * `chrono_datetime_as_bson_datetime`. Day-only inputs are anchored at
 * UTC midnight so the inclusive `from..=to` count stays stable across
 * client timezones.
 */
function toIsoOrUndef(raw?: string): string | undefined {
  if (!raw) return undefined;
  // Date input gives `YYYY-MM-DD` — anchor to UTC midnight.
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return `${raw}T00:00:00Z`;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/**
 * Server-action entry point for the create / edit form.
 *
 * If `formData` carries an `_id`, this performs a PATCH; otherwise a
 * POST. `status` is intentionally NOT forwarded — the Rust DTO doesn't
 * accept it on either create or update (status flips happen through
 * the approve / reject / cancel workflow). The form may still surface
 * a status control for display continuity; we just drop it here.
 */
export async function saveLeaveAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const session = await getSession();
  if (!session?.user) return { error: 'Unauthorized' };

  const id = pickString(formData, '_id');
  const guard = await requirePermission('crm_leave', id ? 'edit' : 'create');
  if (!guard.ok) return { error: guard.error };

  // Keep the flag referenced so the dual-impl helper survives lint.
  void useRustCrm();

  const leaveTypeId = pickString(formData, 'leaveTypeId');
  const from = toIsoOrUndef(pickString(formData, 'from'));
  const to = toIsoOrUndef(pickString(formData, 'to'));

  if (!leaveTypeId) {
    return { error: 'Leave type is required.' };
  }
  if (!from || !to) {
    return { error: 'Start and end dates are required.' };
  }
  if (new Date(to).getTime() < new Date(from).getTime()) {
    return { error: 'End date must be on or after start date.' };
  }

  const halfDay = pickBool(formData, 'halfDay') ?? false;
  const reason = pickString(formData, 'reason');
  const employeeId = pickString(formData, 'employeeId');

  try {
    let result: CrmLeaveDoc;
    if (id) {
      const patch: CrmLeaveUpdateInput = {
        leaveTypeId,
        from,
        to,
        halfDay,
        reason,
      };
      result = await crmLeavesApi.update(id, patch);
    } else {
      const draft: CrmLeaveCreateInput = {
        leaveTypeId,
        from,
        to,
        halfDay,
        reason,
        employeeId,
      };
      result = await crmLeavesApi.create(draft);
    }

    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: id ? 'update' : 'create',
        entityKind: 'leave',
        entityId: String(result._id),
      });
    } catch {
      /* non-fatal */
    }

    // Fire the `leave_applied` notification on initial create. The manager
    // recipient + lookup data (employeeName, manager email) is owned by the
    // Rust BFF — until those fields are wired through, we render the
    // template with the current session as a best-effort fallback so the
    // template engine path is exercised. Manager-routing TODO lives in
    // `src/app/actions/email-templates.actions.ts`-adjacent issue list.
    if (!id) {
      try {
        const { dispatchTransactionalEmail } = await import('@/lib/email-dispatcher');
        const { renderEffectiveTemplate } = await import(
          '@/lib/email-templates/render'
        );
        const tenantUserId = String(session.user._id);
        const rendered = await renderEffectiveTemplate(
          tenantUserId,
          'leave_applied',
          {
            managerName: '',
            employeeName: session.user.name ?? '',
            leaveType: leaveTypeId,
            fromDate: from,
            toDate: to,
            durationDays: Math.max(
              1,
              Math.round(
                (new Date(to).getTime() - new Date(from).getTime()) /
                  (1000 * 60 * 60 * 24),
              ) + 1,
            ),
            reason: reason ?? '',
            approvalUrl: `${LIST_PATH}/${String(result._id)}`,
          },
        );
        if (session.user.email) {
          await dispatchTransactionalEmail({
            tenantUserId,
            to: session.user.email,
            subject: rendered.subject,
            html: rendered.html,
            templateId: 'event:leave_applied',
          });
        }
      } catch (notifyErr) {
        console.warn('[crm/leaves] leave_applied notify failed', notifyErr);
      }
    }

    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${String(result._id)}`);
    return {
      message: id ? 'Leave request updated.' : 'Leave request submitted.',
      id: String(result._id),
    };
  } catch (e) {
    recordRustFallback({ entity: 'leave', op: id ? 'update' : 'create', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
    return { error: rustErr(e) };
  }
}

/**
 * Hard-delete a leave application. The Rust handler removes the row
 * from the collection — no soft-delete flag.
 */
export async function deleteLeaveAction(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  if (!id) return { success: false, error: 'Missing leave id.' };

  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Unauthorized' };

  const guard = await requirePermission('crm_leave', 'delete');
  if (!guard.ok) return { success: false, error: guard.error };

  try {
    await crmLeavesApi.delete(id);
    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: 'delete',
        entityKind: 'leave',
        entityId: id,
      });
    } catch {
      /* non-fatal */
    }
    revalidatePath(LIST_PATH);
    return { success: true };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { success: false, error: 'Leave not found.' };
    }
    recordRustFallback({ entity: 'leave', op: 'delete', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
    return { success: false, error: rustErr(e) };
  }
}

/* ─── Programmatic helpers (typed) ────────────────────────────── */
//
// 'use server' files only allow async exports — these helpers thinly
// wrap the Rust client so callers don't have to remember `await
// crmLeavesApi.x(...)`.

export async function createLeave(input: CrmLeaveCreateInput) {
  return crmLeavesApi.create(input);
}

export async function updateLeave(id: string, patch: CrmLeaveUpdateInput) {
  return crmLeavesApi.update(id, patch);
}

export async function deleteLeave(id: string) {
  return crmLeavesApi.delete(id);
}

/**
 * Fetch the tenant's leave-type catalog for the form's `leaveTypeId`
 * dropdown. The catalog itself is managed under
 * `/dashboard/crm/hr-payroll/leave/types/` (a separate sub-feature).
 */
export async function listLeaveTypeOptions(): Promise<{
  options: CrmLeaveTypeOption[];
  error?: string;
}> {
  try {
    const options = await crmLeaveTypesApi.list();
    return { options };
  } catch (e) {
    return { options: [], error: rustErr(e) };
  }
}
