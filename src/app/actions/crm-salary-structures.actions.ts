'use server';

/**
 * CRM Salary Structures — Rust-backed server actions for the
 * /dashboard/hrm/payroll/salary-structure entity.
 *
 * Delegates entirely to `crmSalaryStructuresApi`. Field shape mirrors
 * the Rust DTO (`rust/crates/crm-salary-structures/src/dto.rs`).
 */

import { revalidatePath } from 'next/cache';

import { getSession } from '@/app/actions/user.actions';
import { requirePermission } from '@/lib/rbac-server';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
    crmSalaryStructuresApi,
    type CrmSalaryStructureCreateInput,
    type CrmSalaryStructureDoc,
    type CrmSalaryStructureListParams,
    type CrmSalaryStructureListResponse,
    type CrmSalaryStructureStatus,
    type CrmSalaryStructureUpdateInput,
} from '@/lib/rust-client/crm-salary-structures';

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

/* ─── Reads ──────────────────────────────────────────────────────────── */

export async function getSalaryStructuresList(
    filters?: CrmSalaryStructureListParams,
): Promise<CrmSalaryStructureListResponse> {
    const empty: CrmSalaryStructureListResponse = {
        items: [],
        page: 1,
        limit: 50,
        hasMore: false,
    };

    const session = await getSession();
    if (!session?.user) return empty;

    const guard = await requirePermission('crm_payroll', 'view');
    if (!guard.ok) return empty;

    try {
        return await crmSalaryStructuresApi.list(filters);
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[getSalaryStructuresList] rust call failed:', msg);
        recordRustFallback({
            entity: 'salary_structure',
            op: 'list',
            errorCode: code,
            status,
        });
        return empty;
    }
}

export async function getSalaryStructureDoc(
    id: string,
): Promise<CrmSalaryStructureDoc | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!id) return null;

    const guard = await requirePermission('crm_payroll', 'view');
    if (!guard.ok) return null;

    try {
        return await crmSalaryStructuresApi.getById(id);
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[getSalaryStructureDoc] rust call failed:', msg);
        recordRustFallback({
            entity: 'salary_structure',
            op: 'get',
            errorCode: code,
            status,
        });
        return null;
    }
}

/* ─── Writes ─────────────────────────────────────────────────────────── */

const VALID_STATUSES: ReadonlySet<CrmSalaryStructureStatus> = new Set<
    CrmSalaryStructureStatus
>(['active', 'archived']);

function readPayload(formData: FormData): {
    payload: CrmSalaryStructureCreateInput;
    error?: string;
} {
    const employeeId = asString(formData.get('employeeId'));
    if (!employeeId)
        return {
            payload: {} as CrmSalaryStructureCreateInput,
            error: 'Employee is required.',
        };

    const basic = asNumber(formData.get('basic'));
    if (basic == null)
        return {
            payload: {} as CrmSalaryStructureCreateInput,
            error: 'Basic salary is required.',
        };

    const payload: CrmSalaryStructureCreateInput = {
        employeeId,
        employeeName: asString(formData.get('employeeName')),
        effectiveFrom: asString(formData.get('effectiveFrom')),
        basic,
        hra: asNumber(formData.get('hra')),
        da: asNumber(formData.get('da')),
        otherAllowances: asNumber(formData.get('otherAllowances')),
        pfEmployer: asNumber(formData.get('pfEmployer')),
        pfEmployee: asNumber(formData.get('pfEmployee')),
        esi: asNumber(formData.get('esi')),
        professionalTax: asNumber(formData.get('professionalTax')),
        gross: asNumber(formData.get('gross')),
        net: asNumber(formData.get('net')),
    };

    return { payload };
}

export async function saveSalaryStructureDoc(
    _prev: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const docId = asString(formData.get('structureId'));
    const isEditing = !!docId;

    const guard = await requirePermission(
        'crm_payroll',
        isEditing ? 'edit' : 'create',
    );
    if (!guard.ok) return { error: guard.error };

    const { payload, error } = readPayload(formData);
    if (error) return { error };

    const statusRaw = asString(formData.get('status'));
    const status: CrmSalaryStructureStatus | undefined =
        statusRaw && VALID_STATUSES.has(statusRaw as CrmSalaryStructureStatus)
            ? (statusRaw as CrmSalaryStructureStatus)
            : undefined;

    try {
        if (isEditing) {
            const patch: CrmSalaryStructureUpdateInput = {
                ...payload,
                ...(status ? { status } : {}),
            };
            const updated = await crmSalaryStructuresApi.update(docId!, patch);
            revalidatePath('/dashboard/hrm/payroll/salary-structure');
            revalidatePath(`/dashboard/hrm/payroll/salary-structure/${docId}`);
            return {
                message: 'Salary structure updated.',
                id: updated?._id ?? docId,
            };
        }

        const created = await crmSalaryStructuresApi.create(payload);
        revalidatePath('/dashboard/hrm/payroll/salary-structure');
        return {
            message: 'Salary structure created.',
            id: created.id,
        };
    } catch (e) {
        const { code, status: httpStatus, msg } = rustError(e);
        console.error('[saveSalaryStructureDoc] rust call failed:', msg);
        recordRustFallback({
            entity: 'salary_structure',
            op: isEditing ? 'update' : 'create',
            errorCode: code,
            status: httpStatus,
        });
        return { error: `Failed to save salary structure: ${msg}` };
    }
}

export async function deleteSalaryStructureDoc(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!id) return { success: false, error: 'Structure id is required.' };

    const guard = await requirePermission('crm_payroll', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const result = await crmSalaryStructuresApi.delete(id);
        revalidatePath('/dashboard/hrm/payroll/salary-structure');
        return { success: !!result?.deleted };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[deleteSalaryStructureDoc] rust call failed:', msg);
        recordRustFallback({
            entity: 'salary_structure',
            op: 'delete',
            errorCode: code,
            status,
        });
        return { success: false, error: `Failed to delete: ${msg}` };
    }
}
