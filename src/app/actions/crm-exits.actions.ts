'use server';

/**
 * CRM HR Exits — server-action wrappers around the Rust crate.
 *
 * Primary path: `crmExitsApi`. On Rust failure we record a fallback
 * telemetry event and surface the error — there is no Mongo shadow
 * read because this entity is fully owned by the Rust crate.
 *
 * Field shape mirrors the Rust DTO (`rust/crates/crm-exits`) which
 * serialises with `rename_all = "camelCase"`.
 */

import { revalidatePath } from 'next/cache';

import { getSession } from '@/app/actions/user.actions';
import { requirePermission } from '@/lib/rbac-server';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
    crmExitsApi,
    type CrmExitCreateInput,
    type CrmExitDoc,
    type CrmExitListParams,
    type CrmExitListResponse,
    type CrmExitStatus,
    type CrmExitType,
    type CrmExitUpdateInput,
} from '@/lib/rust-client/crm-exits';

/* ─── Helpers ────────────────────────────────────────────────────────── */

function asString(v: FormDataEntryValue | null): string | undefined {
    if (v == null) return undefined;
    const s = String(v).trim();
    return s.length > 0 ? s : undefined;
}

function rustError(e: unknown): { code?: string; status?: number; msg: string } {
    if (e instanceof RustApiError) {
        return { code: e.code, status: e.status, msg: e.message };
    }
    return { msg: e instanceof Error ? e.message : 'Unknown error' };
}

const VALID_STATUSES: ReadonlySet<CrmExitStatus> = new Set<CrmExitStatus>([
    'open',
    'complete',
    'cancelled',
    'archived',
]);

const VALID_TYPES: ReadonlySet<CrmExitType> = new Set<CrmExitType>([
    'resignation',
    'termination',
    'retirement',
    'end_of_contract',
    'other',
]);

/* ─── Reads ──────────────────────────────────────────────────────────── */

export async function getExits(
    filters?: CrmExitListParams,
): Promise<CrmExitListResponse> {
    const empty: CrmExitListResponse = {
        items: [],
        page: 1,
        limit: 50,
        hasMore: false,
    };

    const session = await getSession();
    if (!session?.user) return empty;

    const guard = await requirePermission('crm_exit', 'view');
    if (!guard.ok) return empty;

    try {
        return await crmExitsApi.list(filters);
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[getExits] rust call failed:', msg);
        recordRustFallback({
            entity: 'exit',
            op: 'list',
            errorCode: code,
            status,
        });
        return empty;
    }
}

export async function getExitById(id: string): Promise<CrmExitDoc | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!id) return null;

    const guard = await requirePermission('crm_exit', 'view');
    if (!guard.ok) return null;

    try {
        return await crmExitsApi.getById(id);
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[getExitById] rust call failed:', msg);
        recordRustFallback({
            entity: 'exit',
            op: 'get',
            errorCode: code,
            status,
        });
        return null;
    }
}

/* ─── Writes ─────────────────────────────────────────────────────────── */

function readPayload(formData: FormData): {
    payload: CrmExitCreateInput;
    status?: CrmExitStatus;
    error?: string;
} {
    const employeeName = asString(formData.get('employeeName'));
    const employeeId = asString(formData.get('employeeId'));
    if (!employeeName && !employeeId) {
        return {
            payload: {} as CrmExitCreateInput,
            error: 'Employee name or ID is required.',
        };
    }

    const typeRaw = asString(formData.get('type'));
    const type: CrmExitType | undefined =
        typeRaw && VALID_TYPES.has(typeRaw as CrmExitType)
            ? (typeRaw as CrmExitType)
            : undefined;

    const statusRaw = asString(formData.get('status'));
    const status: CrmExitStatus | undefined =
        statusRaw && VALID_STATUSES.has(statusRaw as CrmExitStatus)
            ? (statusRaw as CrmExitStatus)
            : undefined;

    // Settlement breakdown — display-only on the form but persisted so the
    // detail page can show the same calculator state. Each is optional; an
    // empty string or non-numeric value collapses to `undefined`.
    const asOptionalNumber = (raw: FormDataEntryValue | null): number | undefined => {
        const s = asString(raw);
        if (!s) return undefined;
        const n = Number(s);
        return Number.isFinite(n) ? n : undefined;
    };

    // Documents JSON list (additive) — sourced from SabFiles.
    const documentsRaw = asString(formData.get('documents'));
    let documents:
        | {
              id: string;
              url: string;
              name: string;
              mime?: string;
              size?: number;
          }[]
        | undefined;
    if (documentsRaw) {
        try {
            const parsed: unknown = JSON.parse(documentsRaw);
            if (Array.isArray(parsed)) {
                documents = parsed
                    .filter(
                        (a): a is Record<string, unknown> =>
                            !!a && typeof a === 'object',
                    )
                    .map((a) => ({
                        id: String(a.id ?? ''),
                        url: String(a.url ?? ''),
                        name: String(a.name ?? ''),
                        mime: a.mime != null ? String(a.mime) : undefined,
                        size:
                            typeof a.size === 'number'
                                ? a.size
                                : a.size != null
                                  ? Number(a.size)
                                  : undefined,
                    }))
                    .filter((a) => a.id && a.url);
            }
        } catch {
            /* swallow invalid JSON */
        }
    }

    const reportingManagerId = asString(formData.get('reportingManagerId'));
    const reportingManagerName = asString(
        formData.get('reportingManagerName'),
    );

    const grossPay = asOptionalNumber(formData.get('grossPay'));
    const bonuses = asOptionalNumber(formData.get('bonuses'));
    const deductions = asOptionalNumber(formData.get('deductions'));
    const settlementAmount =
        grossPay !== undefined || bonuses !== undefined || deductions !== undefined
            ? (grossPay ?? 0) + (bonuses ?? 0) - (deductions ?? 0)
            : undefined;

    // Extension fields are additive on the Rust DTO — the crate ignores
    // unknown keys, so we widen the payload type here without bumping the
    // canonical `CrmExitCreateInput`.
    const payload: CrmExitCreateInput & {
        reportingManagerId?: string;
        reportingManagerName?: string;
        grossPay?: number;
        bonuses?: number;
        deductions?: number;
        settlementAmount?: number;
        documents?: typeof documents;
    } = {
        employeeName,
        employeeId,
        type: type ?? 'resignation',
        noticeStart: asString(formData.get('noticeStart')),
        lastDay: asString(formData.get('lastDay')),
        fnfStatus: asString(formData.get('fnfStatus')) ?? 'pending',
        nocStatus: asString(formData.get('nocStatus')) ?? 'pending',
        assetReturnStatus: asString(formData.get('assetReturnStatus')) ?? 'pending',
        knowledgeTransferStatus:
            asString(formData.get('knowledgeTransferStatus')) ?? 'pending',
        exitInterviewNotes: asString(formData.get('exitInterviewNotes')),
        reason: asString(formData.get('reason')),
        notes: asString(formData.get('notes')),
        ...(reportingManagerId ? { reportingManagerId } : {}),
        ...(reportingManagerName ? { reportingManagerName } : {}),
        ...(grossPay !== undefined ? { grossPay } : {}),
        ...(bonuses !== undefined ? { bonuses } : {}),
        ...(deductions !== undefined ? { deductions } : {}),
        ...(settlementAmount !== undefined ? { settlementAmount } : {}),
        ...(documents && documents.length > 0 ? { documents } : {}),
    };

    return { payload, status };
}

export async function saveExit(
    _prev: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const exitId = asString(formData.get('exitId'));
    const isEditing = !!exitId;

    const guard = await requirePermission(
        'crm_exit',
        isEditing ? 'edit' : 'create',
    );
    if (!guard.ok) return { error: guard.error };

    const { payload, status, error } = readPayload(formData);
    if (error) return { error };

    try {
        if (isEditing) {
            const patch: CrmExitUpdateInput = { ...payload };
            if (status) patch.status = status;
            const updated = await crmExitsApi.update(exitId!, patch);
            revalidatePath('/dashboard/hrm/hr/exits');
            revalidatePath(`/dashboard/hrm/hr/exits/${exitId}`);
            return {
                message: 'Exit updated.',
                id: updated?._id ?? exitId,
            };
        }

        const created = await crmExitsApi.create(payload);
        revalidatePath('/dashboard/hrm/hr/exits');
        return {
            message: 'Exit created.',
            id: created.id,
        };
    } catch (e) {
        const { code, status: httpStatus, msg } = rustError(e);
        console.error('[saveExit] rust call failed:', msg);
        recordRustFallback({
            entity: 'exit',
            op: isEditing ? 'update' : 'create',
            errorCode: code,
            status: httpStatus,
        });
        return { error: `Failed to save exit: ${msg}` };
    }
}

export async function deleteExit(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!id) return { success: false, error: 'Exit id is required.' };

    const guard = await requirePermission('crm_exit', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const result = await crmExitsApi.delete(id);
        revalidatePath('/dashboard/hrm/hr/exits');
        return { success: !!result?.deleted };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[deleteExit] rust call failed:', msg);
        recordRustFallback({
            entity: 'exit',
            op: 'delete',
            errorCode: code,
            status,
        });
        return { success: false, error: `Failed to delete exit: ${msg}` };
    }
}

/* ─── KPI ─────────────────────────────────────────────────────────────── */

export interface ExitKpis {
    total: number;
    pendingClearance: number;
    completedThisMonth: number;
    avgNoticeDays: number;
}

export async function getExitKpis(): Promise<ExitKpis> {
    const empty: ExitKpis = {
        total: 0,
        pendingClearance: 0,
        completedThisMonth: 0,
        avgNoticeDays: 0,
    };

    const session = await getSession();
    if (!session?.user) return empty;

    const guard = await requirePermission('crm_exit', 'view');
    if (!guard.ok) return empty;

    try {
        const res = await crmExitsApi.list({ limit: 500 });
        const items = res.items ?? [];

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const pendingClearance = items.filter(
            (e) => e.status === 'open' && (e.fnfStatus === 'pending' || e.nocStatus === 'pending'),
        ).length;

        const completedThisMonth = items.filter((e) => {
            if (e.status !== 'complete') return false;
            const d = e.updatedAt ? new Date(e.updatedAt) : null;
            return d && d >= startOfMonth;
        }).length;

        const noticeDurations = items
            .filter((e) => e.noticeStart && e.lastDay)
            .map((e) => {
                const start = new Date(e.noticeStart!).getTime();
                const end = new Date(e.lastDay!).getTime();
                const diff = (end - start) / 86_400_000;
                return Number.isFinite(diff) && diff >= 0 ? diff : null;
            })
            .filter((d): d is number => d !== null);

        const avgNoticeDays =
            noticeDurations.length > 0
                ? Math.round(
                      noticeDurations.reduce((a, b) => a + b, 0) / noticeDurations.length,
                  )
                : 0;

        return {
            total: items.length,
            pendingClearance,
            completedThisMonth,
            avgNoticeDays,
        };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[getExitKpis] rust call failed:', msg);
        recordRustFallback({ entity: 'exit', op: 'list', errorCode: code, status });
        return empty;
    }
}

/* ─── Bulk ────────────────────────────────────────────────────────────── */

export async function bulkUpdateExitStatus(
    ids: string[],
    status: CrmExitStatus,
): Promise<{ succeeded: number; failed: number }> {
    const session = await getSession();
    if (!session?.user) return { succeeded: 0, failed: ids.length };

    const guard = await requirePermission('crm_exit', 'edit');
    if (!guard.ok) return { succeeded: 0, failed: ids.length };

    let succeeded = 0;
    let failed = 0;

    for (const id of ids) {
        try {
            await crmExitsApi.update(id, { status });
            succeeded++;
        } catch {
            failed++;
        }
    }

    if (succeeded > 0) revalidatePath('/dashboard/crm/hr/exits');
    return { succeeded, failed };
}

export async function bulkDeleteExits(
    ids: string[],
): Promise<{ succeeded: number; failed: number }> {
    const session = await getSession();
    if (!session?.user) return { succeeded: 0, failed: ids.length };

    const guard = await requirePermission('crm_exit', 'delete');
    if (!guard.ok) return { succeeded: 0, failed: ids.length };

    let succeeded = 0;
    let failed = 0;

    for (const id of ids) {
        try {
            await crmExitsApi.delete(id);
            succeeded++;
        } catch {
            failed++;
        }
    }

    if (succeeded > 0) revalidatePath('/dashboard/crm/hr/exits');
    return { succeeded, failed };
}
