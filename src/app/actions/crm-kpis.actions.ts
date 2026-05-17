'use server';

/**
 * CRM HR KPI Tracking — server-action wrappers around the Rust crate.
 *
 * Delegates to `crmKpisApi` (Rust `/v1/crm/kpis`). On failure we record a
 * fallback telemetry event and return `{ error }` — there is no Mongo
 * shadow read. Field shape mirrors the Rust DTO (camelCase).
 */

import { revalidatePath } from 'next/cache';

import { getSession } from '@/app/actions/user.actions';
import { requirePermission } from '@/lib/rbac-server';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
    crmKpisApi,
    type CrmKpiCreateInput,
    type CrmKpiDoc,
    type CrmKpiFrequency,
    type CrmKpiListParams,
    type CrmKpiListResponse,
    type CrmKpiStatus,
    type CrmKpiUpdateInput,
} from '@/lib/rust-client/crm-kpis';

/* ─── Helpers ────────────────────────────────────────────────────────── */

function asString(v: FormDataEntryValue | null): string | undefined {
    if (v == null) return undefined;
    const s = String(v).trim();
    return s.length > 0 ? s : undefined;
}

function asNumber(v: FormDataEntryValue | null): number | undefined {
    if (v == null) return undefined;
    const s = String(v).trim();
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

const VALID_STATUSES: ReadonlySet<CrmKpiStatus> = new Set<CrmKpiStatus>([
    'active',
    'archived',
]);

const VALID_FREQUENCIES: ReadonlySet<string> = new Set<string>([
    'monthly',
    'quarterly',
    'annual',
]);

/* ─── Reads ──────────────────────────────────────────────────────────── */

export async function getKpis(
    filters?: CrmKpiListParams,
): Promise<CrmKpiListResponse> {
    const empty: CrmKpiListResponse = {
        items: [],
        page: 1,
        limit: 50,
        hasMore: false,
    };

    const session = await getSession();
    if (!session?.user) return empty;

    const guard = await requirePermission('crm_kpi', 'view');
    if (!guard.ok) return empty;

    try {
        return await crmKpisApi.list(filters);
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[getKpis] rust call failed:', msg);
        recordRustFallback({
            entity: 'kpi',
            op: 'list',
            errorCode: code,
            status,
        });
        return empty;
    }
}

export async function getKpiById(id: string): Promise<CrmKpiDoc | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!id) return null;

    const guard = await requirePermission('crm_kpi', 'view');
    if (!guard.ok) return null;

    try {
        return await crmKpisApi.getById(id);
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[getKpiById] rust call failed:', msg);
        recordRustFallback({
            entity: 'kpi',
            op: 'get',
            errorCode: code,
            status,
        });
        return null;
    }
}

/* ─── Writes ─────────────────────────────────────────────────────────── */

function readPayload(formData: FormData): {
    payload: CrmKpiCreateInput;
    status?: CrmKpiStatus;
    error?: string;
} {
    const name = asString(formData.get('name'));
    if (!name) {
        return { payload: {} as CrmKpiCreateInput, error: 'Name is required.' };
    }

    const frequencyRaw = asString(formData.get('frequency'));
    const frequency: CrmKpiFrequency | undefined =
        frequencyRaw && VALID_FREQUENCIES.has(frequencyRaw)
            ? (frequencyRaw as CrmKpiFrequency)
            : undefined;

    const statusRaw = asString(formData.get('status'));
    const status: CrmKpiStatus | undefined =
        statusRaw && VALID_STATUSES.has(statusRaw as CrmKpiStatus)
            ? (statusRaw as CrmKpiStatus)
            : undefined;

    const payload: CrmKpiCreateInput = {
        name,
        description: asString(formData.get('description')),
        target: asString(formData.get('target')),
        unit: asString(formData.get('unit')),
        owner: asString(formData.get('owner')),
        department: asString(formData.get('department')),
        weight: asNumber(formData.get('weight')),
        category: asString(formData.get('category')),
        ...(frequency ? { frequency } : {}),
    };

    return { payload, status };
}

export async function saveKpi(
    _prev: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const kpiId = asString(formData.get('kpiId'));
    const isEditing = !!kpiId;

    const guard = await requirePermission(
        'crm_kpi',
        isEditing ? 'update' : 'create',
    );
    if (!guard.ok) return { error: guard.error };

    const { payload, status, error } = readPayload(formData);
    if (error) return { error };

    try {
        if (isEditing) {
            const patch: CrmKpiUpdateInput = { ...payload, ...(status ? { status } : {}) };
            const updated = await crmKpisApi.update(kpiId!, patch);
            revalidatePath('/dashboard/hrm/payroll/kpi-tracking');
            revalidatePath(`/dashboard/hrm/payroll/kpi-tracking/${kpiId}`);
            return {
                message: 'KPI updated.',
                id: updated?._id ?? kpiId,
            };
        }

        const created = await crmKpisApi.create(payload);
        revalidatePath('/dashboard/hrm/payroll/kpi-tracking');
        return {
            message: 'KPI created.',
            id: created.id,
        };
    } catch (e) {
        const { code, status: errStatus, msg } = rustError(e);
        console.error('[saveKpi] rust call failed:', msg);
        recordRustFallback({
            entity: 'kpi',
            op: isEditing ? 'update' : 'create',
            errorCode: code,
            status: errStatus,
        });
        return { error: `Failed to save KPI: ${msg}` };
    }
}

export async function deleteKpi(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!id) return { success: false, error: 'KPI id is required.' };

    const guard = await requirePermission('crm_kpi', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const result = await crmKpisApi.delete(id);
        revalidatePath('/dashboard/hrm/payroll/kpi-tracking');
        return { success: !!result?.deleted };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[deleteKpi] rust call failed:', msg);
        recordRustFallback({
            entity: 'kpi',
            op: 'delete',
            errorCode: code,
            status,
        });
        return { success: false, error: `Failed to delete KPI: ${msg}` };
    }
}
