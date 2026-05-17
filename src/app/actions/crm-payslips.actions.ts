'use server';

/**
 * CRM Payslips — Rust-backed server actions for the
 * /dashboard/hrm/payroll/payslips entity (list + detail only).
 *
 * Delegates entirely to `crmPayslipsApi` from
 * `@/lib/rust-client/crm-payslips`. On Rust failure we record a
 * fallback telemetry event and return a benign empty/null response so
 * the UI renders an empty state instead of crashing.
 */

import { revalidatePath } from 'next/cache';
import { getSession } from '@/app/actions/user.actions';
import { requirePermission } from '@/lib/rbac-server';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
    crmPayslipsApi,
    type CrmPayslipDoc,
    type CrmPayslipListParams,
    type CrmPayslipListResponse,
} from '@/lib/rust-client/crm-payslips';

function rustError(e: unknown): { code?: string; status?: number; msg: string } {
    if (e instanceof RustApiError) {
        return { code: e.code, status: e.status, msg: e.message };
    }
    return { msg: e instanceof Error ? e.message : 'Unknown error' };
}

export async function getPayslipsList(
    filters?: CrmPayslipListParams,
): Promise<CrmPayslipListResponse> {
    const empty: CrmPayslipListResponse = {
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
        return await crmPayslipsApi.list(filters);
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[getPayslipsList] rust call failed:', msg);
        recordRustFallback({
            entity: 'payslip',
            op: 'list',
            errorCode: code,
            status,
        });
        return empty;
    }
}

export async function getPayslipDoc(id: string): Promise<CrmPayslipDoc | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!id) return null;

    const guard = await requirePermission('crm_payroll', 'view');
    if (!guard.ok) return null;

    try {
        return await crmPayslipsApi.getById(id);
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[getPayslipDoc] rust call failed:', msg);
        recordRustFallback({
            entity: 'payslip',
            op: 'get',
            errorCode: code,
            status,
        });
        return null;
    }
}

/* ─── Write-side actions used by the payslip UI ─────────────────────── */

const DETAIL_PATH = '/dashboard/crm/hr-payroll/payslips';

async function updatePayslipStatus(
    id: string,
    next: 'paid' | 'archived',
): Promise<{ success: boolean; error?: string }> {
    if (!id) return { success: false, error: 'Missing payslip id.' };

    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Unauthorized.' };

    const guard = await requirePermission('crm_payroll', 'edit');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        await crmPayslipsApi.update(id, { status: next });
        revalidatePath(DETAIL_PATH);
        revalidatePath(`${DETAIL_PATH}/${id}`);
        return { success: true };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error(`[updatePayslipStatus → ${next}] rust call failed:`, msg);
        recordRustFallback({
            entity: 'payslip',
            op: 'update',
            errorCode: code,
            status,
        });
        return { success: false, error: msg };
    }
}

export async function acknowledgePayslipAction(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    return updatePayslipStatus(id, 'paid');
}

export async function archivePayslipAction(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    return updatePayslipStatus(id, 'archived');
}

function num(formData: FormData, key: string): number | undefined {
    const raw = formData.get(key);
    if (typeof raw !== 'string' || raw.trim() === '') return undefined;
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
}

/**
 * `useActionState`-compatible create/update for the payslip form.
 * Decodes the curated `CrmPayslipCreateInput` from FormData; computes
 * `gross` / `net` defaults when the user left them blank.
 */
export async function savePayslipAction(
    _prevState: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Unauthorized.' };

    const id = (formData.get('_id') as string | null) || undefined;
    const isEditing = !!id;

    const guard = await requirePermission(
        'crm_payroll',
        isEditing ? 'edit' : 'create',
    );
    if (!guard.ok) return { error: guard.error };

    const employeeId = (formData.get('employeeId') as string | null)?.trim();
    if (!employeeId) return { error: 'Employee ID is required.' };

    const payPeriod = (formData.get('payPeriod') as string | null)?.trim();
    if (!payPeriod) return { error: 'Pay period is required.' };

    const basic = num(formData, 'basic') ?? 0;
    const hra = num(formData, 'hra') ?? 0;
    const allowances = num(formData, 'allowances');
    const pf = num(formData, 'pf');
    const esi = num(formData, 'esi');
    const tax = num(formData, 'tax');
    const deductionsExtra = num(formData, 'deductions') ?? 0;

    const computedGross = basic + hra + (allowances ?? 0);
    const gross = num(formData, 'gross') ?? computedGross;
    const totalDeductions = (pf ?? 0) + (esi ?? 0) + (tax ?? 0) + deductionsExtra;
    const net = num(formData, 'net') ?? gross - totalDeductions;

    const status =
        ((formData.get('status') as string | null) ?? 'draft') as
            | 'draft'
            | 'issued'
            | 'paid'
            | 'archived';

    const issuedAtRaw = formData.get('issuedAt') as string | null;
    const issuedAt = issuedAtRaw ? new Date(issuedAtRaw).toISOString() : undefined;

    const employeeName =
        ((formData.get('employeeName') as string | null) ?? '').trim() || undefined;

    const input = {
        employeeId,
        employeeName,
        payPeriod,
        basic,
        hra,
        allowances,
        deductions: totalDeductions,
        pf,
        esi,
        tax,
        gross,
        net,
        status,
        issuedAt,
    };

    try {
        if (isEditing && id) {
            await crmPayslipsApi.update(id, input);
            revalidatePath(DETAIL_PATH);
            revalidatePath(`${DETAIL_PATH}/${id}`);
            return { message: 'Payslip updated.', id };
        }
        const created = await crmPayslipsApi.create(input);
        revalidatePath(DETAIL_PATH);
        const newId = (created as any)?.id ?? (created as any)?.entity?._id;
        return { message: 'Payslip created.', id: newId };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[savePayslipAction] rust call failed:', msg);
        recordRustFallback({
            entity: 'payslip',
            op: isEditing ? 'update' : 'create',
            errorCode: code,
            status,
        });
        return { error: msg };
    }
}
