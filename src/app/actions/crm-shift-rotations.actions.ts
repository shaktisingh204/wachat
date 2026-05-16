'use server';

/**
 * CRM Shift Rotations — server-action wrappers around the Rust crate
 * `crm-shift-rotations`.
 *
 * A rotation defines a repeating pattern of shifts across `cycleDays`,
 * scoped to an employee / department / team. The pattern is a
 * `Vec<{ dayOffset, shiftId, isOff }>` so it needs structured payload
 * handling rather than the usual flat FormData.
 */

import { revalidatePath } from 'next/cache';

import { getSession } from '@/app/actions/user.actions';
import { requirePermission } from '@/lib/rbac-server';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
    crmShiftRotationsApi,
    type CrmShiftRotationCreateInput,
    type CrmShiftRotationDay,
    type CrmShiftRotationDoc,
    type CrmShiftRotationListParams,
    type CrmShiftRotationListResponse,
    type CrmShiftRotationStatus,
    type CrmShiftRotationUpdateInput,
} from '@/lib/rust-client/crm-shift-rotations';

const LIST_PATH = '/dashboard/hrm/payroll/shift-rotations';

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

function rustError(e: unknown): { code?: string; status?: number; msg: string } {
    if (e instanceof RustApiError) {
        return { code: e.code, status: e.status, msg: e.message };
    }
    return { msg: e instanceof Error ? e.message : 'Unknown error' };
}

const VALID_STATUSES: ReadonlySet<CrmShiftRotationStatus> = new Set<
    CrmShiftRotationStatus
>(['active', 'paused', 'completed', 'archived']);

/* ─── Reads ──────────────────────────────────────────────────────────── */

export async function getShiftRotations(
    filters?: CrmShiftRotationListParams,
): Promise<CrmShiftRotationListResponse> {
    const empty: CrmShiftRotationListResponse = {
        items: [],
        page: 1,
        limit: 100,
        hasMore: false,
    };

    const session = await getSession();
    if (!session?.user) return empty;

    const guard = await requirePermission('crm_shift_rotation', 'view');
    if (!guard.ok) return empty;

    try {
        return await crmShiftRotationsApi.list(filters);
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[getShiftRotations] rust call failed:', msg);
        recordRustFallback({
            entity: 'shift_rotation',
            op: 'list',
            errorCode: code,
            status,
        });
        return empty;
    }
}

export async function getShiftRotationById(
    id: string,
): Promise<CrmShiftRotationDoc | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!id) return null;

    const guard = await requirePermission('crm_shift_rotation', 'view');
    if (!guard.ok) return null;

    try {
        return await crmShiftRotationsApi.getById(id);
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[getShiftRotationById] rust call failed:', msg);
        recordRustFallback({
            entity: 'shift_rotation',
            op: 'get',
            errorCode: code,
            status,
        });
        return null;
    }
}

/* ─── Writes ─────────────────────────────────────────────────────────── */

/**
 * The pattern is encoded into the form as JSON under `patternJson` to
 * avoid having to enumerate dynamic field names for an arbitrarily long
 * cycle. The form-page renders the repeater and json-stringifies on
 * submit; this action parses + validates that payload.
 */
function readPattern(
    formData: FormData,
    cycleDays: number,
): { pattern: CrmShiftRotationDay[]; error?: string } {
    const raw = asString(formData.get('patternJson'));
    if (!raw) return { pattern: [] };

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return { pattern: [], error: 'Pattern is not valid JSON.' };
    }
    if (!Array.isArray(parsed)) {
        return { pattern: [], error: 'Pattern must be an array of day entries.' };
    }

    const out: CrmShiftRotationDay[] = [];
    for (const item of parsed) {
        if (typeof item !== 'object' || item === null) continue;
        const obj = item as Record<string, unknown>;
        const dayOffset = Number(obj.dayOffset ?? obj.day_offset);
        if (!Number.isFinite(dayOffset)) continue;
        if (cycleDays > 0 && (dayOffset < 0 || dayOffset >= cycleDays)) continue;
        const shiftId = typeof obj.shiftId === 'string' ? obj.shiftId : '';
        const isOff = Boolean(obj.isOff ?? obj.is_off);
        if (!isOff && !shiftId) continue;
        out.push({
            dayOffset,
            shiftId,
            isOff,
            ...(typeof obj.shiftName === 'string'
                ? { shiftName: obj.shiftName as string }
                : {}),
        });
    }
    return { pattern: out };
}

export async function saveShiftRotation(
    _prev: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const rotationId = asString(formData.get('rotationId'));
    const isEditing = !!rotationId;

    const guard = await requirePermission(
        'crm_shift_rotation',
        isEditing ? 'update' : 'create',
    );
    if (!guard.ok) return { error: guard.error };

    const name = asString(formData.get('name'));
    if (!name) return { error: 'Rotation name is required.' };

    const cycleDays = asNumber(formData.get('cycleDays')) ?? 0;
    if (!cycleDays || cycleDays < 1) {
        return { error: 'Cycle length must be at least 1 day.' };
    }

    const startDate = asString(formData.get('startDate'));
    if (!startDate) return { error: 'Start date is required.' };

    const { pattern, error: patternError } = readPattern(formData, cycleDays);
    if (patternError) return { error: patternError };

    const statusRaw = asString(formData.get('status'));
    const status =
        statusRaw && VALID_STATUSES.has(statusRaw as CrmShiftRotationStatus)
            ? (statusRaw as CrmShiftRotationStatus)
            : undefined;

    const payload: CrmShiftRotationCreateInput = {
        name,
        description: asString(formData.get('description')),
        employeeId: asString(formData.get('employeeId')),
        departmentId: asString(formData.get('departmentId')),
        teamId: asString(formData.get('teamId')),
        pattern,
        cycleDays,
        startDate,
        endDate: asString(formData.get('endDate')),
        isActive: !asBool(formData.get('inactive')),
    };

    try {
        if (isEditing) {
            const patch: CrmShiftRotationUpdateInput = {
                ...payload,
                ...(status ? { status } : {}),
            };
            const updated = await crmShiftRotationsApi.update(rotationId!, patch);
            revalidatePath(LIST_PATH);
            revalidatePath(`${LIST_PATH}/${rotationId}`);
            return {
                message: 'Shift rotation updated.',
                id: updated?._id ?? rotationId,
            };
        }

        const created = await crmShiftRotationsApi.create(payload);
        revalidatePath(LIST_PATH);
        return { message: 'Shift rotation created.', id: created.id };
    } catch (e) {
        const { code, status: st, msg } = rustError(e);
        console.error('[saveShiftRotation] rust call failed:', msg);
        recordRustFallback({
            entity: 'shift_rotation',
            op: isEditing ? 'update' : 'create',
            errorCode: code,
            status: st,
        });
        return { error: `Failed to save rotation: ${msg}` };
    }
}

export async function deleteShiftRotation(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!id) return { success: false, error: 'Rotation id is required.' };

    const guard = await requirePermission('crm_shift_rotation', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const result = await crmShiftRotationsApi.delete(id);
        revalidatePath(LIST_PATH);
        return { success: !!result?.deleted };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[deleteShiftRotation] rust call failed:', msg);
        recordRustFallback({
            entity: 'shift_rotation',
            op: 'delete',
            errorCode: code,
            status,
        });
        return { success: false, error: `Failed to delete rotation: ${msg}` };
    }
}
