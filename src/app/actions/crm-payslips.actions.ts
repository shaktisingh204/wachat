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
