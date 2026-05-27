import 'server-only';

/**
 * SabPractice Time Log client — wraps `/v1/sabpractice/time-logs`.
 *
 * The list endpoint returns an extended envelope that includes
 * `totalHours` + `billableHours` rollups in addition to the standard
 * pagination fields; we therefore expose `listWithTotals` alongside the
 * factory-provided `list`.
 */

import { makeCrmClient, type CrmClient } from './crm-base';
import { rustFetch } from './fetcher';

export interface SabPracticeTimeLogDoc {
    _id?: string;
    userId: string;
    taskId: string;
    engagementId?: string;
    clientId?: string;
    loggerUserId: string;
    date: string;
    hours: number;
    notes?: string;
    billable?: boolean;
    billedInvoiceId?: string;
    createdAt: string;
    updatedAt?: string;
}

export interface SabPracticeTimeLogCreateInput {
    taskId: string;
    engagementId?: string;
    clientId?: string;
    loggerUserId: string;
    date: string;
    hours: number;
    notes?: string;
    billable?: boolean;
}

export type SabPracticeTimeLogUpdateInput = Partial<
    Omit<SabPracticeTimeLogCreateInput, 'taskId' | 'loggerUserId'>
> & {
    billedInvoiceId?: string | null;
};

export interface TimeLogListParams {
    page?: number;
    limit?: number;
    taskId?: string;
    engagementId?: string;
    clientId?: string;
    loggerUserId?: string;
    from?: string;
    to?: string;
    billable?: boolean;
    unbilledOnly?: boolean;
}

export interface TimeLogListResponse {
    items: SabPracticeTimeLogDoc[];
    page: number;
    limit: number;
    hasMore: boolean;
    totalHours: number;
    billableHours: number;
}

export const sabpracticeTimeLogsApi: CrmClient<
    SabPracticeTimeLogDoc,
    SabPracticeTimeLogCreateInput
> = makeCrmClient<SabPracticeTimeLogDoc, SabPracticeTimeLogCreateInput>('/v1/sabpractice/time-logs');

function toQuery(params?: TimeLogListParams): string {
    if (!params) return '';
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
        if (v === undefined || v === null || v === '') return;
        sp.set(k, String(v));
    });
    const s = sp.toString();
    return s ? `?${s}` : '';
}

/**
 * Variant of `list` that exposes the `totalHours` + `billableHours`
 * rollup fields returned by the Rust handler.
 */
export async function listSabpracticeTimeLogsWithTotals(
    params?: TimeLogListParams,
): Promise<TimeLogListResponse> {
    const raw = await rustFetch<TimeLogListResponse>(
        `/v1/sabpractice/time-logs${toQuery(params)}`,
    );
    return {
        items: raw.items ?? [],
        page: raw.page ?? 0,
        limit: raw.limit ?? 20,
        hasMore: raw.hasMore ?? false,
        totalHours: raw.totalHours ?? 0,
        billableHours: raw.billableHours ?? 0,
    };
}
