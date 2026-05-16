'use server';

/**
 * CRM Shifts — server-action wrappers around the Rust crate `crm-shifts`.
 *
 * Shifts are master-data records (name + HH:MM start/end + grace/break
 * windows + working-day mask) consumed by attendance / payroll / rotation.
 * This module thinly mirrors `crmShiftsApi` and surfaces `{ message, error,
 * id }` (`useActionState` shape) for the inline-create settings dialog.
 *
 * On Rust failure we record a `recordRustFallback` event and return an
 * empty reply so the UI can render its skeleton/empty state.
 */

import { revalidatePath } from 'next/cache';

import { getSession } from '@/app/actions/user.actions';
import { requirePermission } from '@/lib/rbac-server';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
    crmShiftsApi,
    type CrmShiftCreateInput,
    type CrmShiftDoc,
    type CrmShiftListParams,
    type CrmShiftListResponse,
    type CrmShiftStatus,
    type CrmShiftUpdateInput,
} from '@/lib/rust-client/crm-shifts';

const LIST_PATH = '/dashboard/hrm/payroll/shifts';

/* ─── Helpers ────────────────────────────────────────────────────────── */

function asString(v: FormDataEntryValue | null): string | undefined {
    if (v == null) return undefined;
    const s = String(v).trim();
    return s.length > 0 ? s : undefined;
}

function asBool(v: FormDataEntryValue | null): boolean {
    if (v == null) return false;
    const s = String(v).toLowerCase();
    return s === 'on' || s === 'true' || s === '1' || s === 'yes';
}

function asNumber(v: FormDataEntryValue | null): number | undefined {
    const s = asString(v);
    if (!s) return undefined;
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
}

function asList(v: FormDataEntryValue | null): string[] | undefined {
    const s = asString(v);
    if (!s) return undefined;
    const out = s
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
    return out.length > 0 ? out : undefined;
}

function asAllList(formData: FormData, key: string): string[] | undefined {
    const all = formData.getAll(key);
    if (!all || all.length === 0) return undefined;
    const out = all
        .map((v) => String(v).trim())
        .filter((v) => v.length > 0);
    return out.length > 0 ? out : undefined;
}

function rustError(e: unknown): { code?: string; status?: number; msg: string } {
    if (e instanceof RustApiError) {
        return { code: e.code, status: e.status, msg: e.message };
    }
    return { msg: e instanceof Error ? e.message : 'Unknown error' };
}

/* ─── Reads ──────────────────────────────────────────────────────────── */

export async function getShifts(
    filters?: CrmShiftListParams,
): Promise<CrmShiftListResponse> {
    const empty: CrmShiftListResponse = {
        items: [],
        page: 1,
        limit: 100,
        hasMore: false,
    };

    const session = await getSession();
    if (!session?.user) return empty;

    const guard = await requirePermission('crm_shift', 'view');
    if (!guard.ok) return empty;

    try {
        return await crmShiftsApi.list(filters);
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[getShifts] rust call failed:', msg);
        recordRustFallback({ entity: 'shift', op: 'list', errorCode: code, status });
        return empty;
    }
}

export async function getShiftById(id: string): Promise<CrmShiftDoc | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!id) return null;

    const guard = await requirePermission('crm_shift', 'view');
    if (!guard.ok) return null;

    try {
        return await crmShiftsApi.getById(id);
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[getShiftById] rust call failed:', msg);
        recordRustFallback({ entity: 'shift', op: 'get', errorCode: code, status });
        return null;
    }
}

/* ─── Writes ─────────────────────────────────────────────────────────── */

const VALID_STATUSES: ReadonlySet<CrmShiftStatus> = new Set<CrmShiftStatus>([
    'active',
    'archived',
]);

const HHMM_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;

function readPayload(formData: FormData): {
    payload: CrmShiftCreateInput;
    error?: string;
} {
    const name = asString(formData.get('name'));
    if (!name) {
        return {
            payload: {} as CrmShiftCreateInput,
            error: 'Shift name is required.',
        };
    }

    const startTime = asString(formData.get('startTime'));
    const endTime = asString(formData.get('endTime'));
    if (!startTime || !HHMM_RE.test(startTime)) {
        return {
            payload: {} as CrmShiftCreateInput,
            error: 'Start time must be in HH:MM format.',
        };
    }
    if (!endTime || !HHMM_RE.test(endTime)) {
        return {
            payload: {} as CrmShiftCreateInput,
            error: 'End time must be in HH:MM format.',
        };
    }

    const statusRaw = asString(formData.get('status'));
    const status: CrmShiftStatus | undefined =
        statusRaw && VALID_STATUSES.has(statusRaw as CrmShiftStatus)
            ? (statusRaw as CrmShiftStatus)
            : undefined;

    // working-days arrives as multiple form fields named `workingDays`
    const workingDays =
        asAllList(formData, 'workingDays') ?? asList(formData.get('workingDays'));

    const departmentIds =
        asAllList(formData, 'departmentIds') ??
        asList(formData.get('departmentIds'));

    const payload: CrmShiftCreateInput = {
        name,
        code: asString(formData.get('code')),
        startTime,
        endTime,
        breakMinutes: asNumber(formData.get('breakMinutes')),
        graceMinutes: asNumber(formData.get('graceMinutes')),
        isNightShift: asBool(formData.get('isNightShift')),
        workingDays,
        color: asString(formData.get('color')),
        description: asString(formData.get('description')),
        isDefault: asBool(formData.get('isDefault')),
        departmentIds,
        isActive: true,
    };

    void status; // status only applies to update; readPayload returns the create-shape
    return { payload };
}

export async function saveShift(
    _prev: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const shiftId = asString(formData.get('shiftId'));
    const isEditing = !!shiftId;

    const guard = await requirePermission(
        'crm_shift',
        isEditing ? 'update' : 'create',
    );
    if (!guard.ok) return { error: guard.error };

    const { payload, error } = readPayload(formData);
    if (error) return { error };

    try {
        if (isEditing) {
            const statusRaw = asString(formData.get('status'));
            const patch: CrmShiftUpdateInput = {
                ...payload,
                ...(statusRaw && VALID_STATUSES.has(statusRaw as CrmShiftStatus)
                    ? { status: statusRaw as CrmShiftStatus }
                    : {}),
            };
            const updated = await crmShiftsApi.update(shiftId!, patch);
            revalidatePath(LIST_PATH);
            revalidatePath(`${LIST_PATH}/${shiftId}`);
            return { message: 'Shift updated.', id: updated?._id ?? shiftId };
        }

        const created = await crmShiftsApi.create(payload);
        revalidatePath(LIST_PATH);
        return { message: 'Shift created.', id: created.id };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[saveShift] rust call failed:', msg);
        recordRustFallback({
            entity: 'shift',
            op: isEditing ? 'update' : 'create',
            errorCode: code,
            status,
        });
        return { error: `Failed to save shift: ${msg}` };
    }
}

export async function deleteShift(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!id) return { success: false, error: 'Shift id is required.' };

    const guard = await requirePermission('crm_shift', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const result = await crmShiftsApi.delete(id);
        revalidatePath(LIST_PATH);
        return { success: !!result?.deleted };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[deleteShift] rust call failed:', msg);
        recordRustFallback({ entity: 'shift', op: 'delete', errorCode: code, status });
        return { success: false, error: `Failed to delete shift: ${msg}` };
    }
}
