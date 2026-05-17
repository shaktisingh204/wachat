'use server';

/**
 * CRM Taskboard Columns — server-action wrappers around the Rust crate.
 *
 * Delegates to `crmTaskboardColumnsApi` (Rust). The kanban board reads
 * columns from here to render its lanes; CRUD for columns is owned by
 * the dedicated taskboard-columns page elsewhere.
 */

import { getSession } from '@/app/actions/user.actions';
import { requirePermission } from '@/lib/rbac-server';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
    crmTaskboardColumnsApi,
    type CrmTaskboardColumnDoc,
    type CrmTaskboardColumnListParams,
    type CrmTaskboardColumnListResponse,
} from '@/lib/rust-client/crm-taskboard-columns';

function rustError(e: unknown): { code?: string; status?: number; msg: string } {
    if (e instanceof RustApiError) {
        return { code: e.code, status: e.status, msg: e.message };
    }
    return { msg: e instanceof Error ? e.message : 'Unknown error' };
}

export async function getTaskboardColumns(
    filters?: CrmTaskboardColumnListParams,
): Promise<CrmTaskboardColumnListResponse> {
    const empty: CrmTaskboardColumnListResponse = {
        items: [],
        page: 1,
        limit: 50,
        hasMore: false,
    };

    const session = await getSession();
    if (!session?.user) return empty;

    const guard = await requirePermission('crm_taskboard_column', 'view');
    if (!guard.ok) return empty;

    try {
        return await crmTaskboardColumnsApi.list(filters);
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[getTaskboardColumns] rust call failed:', msg);
        recordRustFallback({
            entity: 'taskboard_column',
            op: 'list',
            errorCode: code,
            status,
        });
        return empty;
    }
}

export async function getTaskboardColumnById(
    id: string,
): Promise<CrmTaskboardColumnDoc | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!id) return null;

    const guard = await requirePermission('crm_taskboard_column', 'view');
    if (!guard.ok) return null;

    try {
        return await crmTaskboardColumnsApi.getById(id);
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[getTaskboardColumnById] rust call failed:', msg);
        recordRustFallback({
            entity: 'taskboard_column',
            op: 'get',
            errorCode: code,
            status,
        });
        return null;
    }
}
