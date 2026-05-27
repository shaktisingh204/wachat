import 'server-only';

/**
 * SabWorkerly Timesheets client — wraps `/v1/sabworkerly/timesheets`.
 * Includes workflow endpoints: submit / approve / reject.
 */

import { rustFetch } from './fetcher';
import { makeCrmClient, type CrmClient } from './crm-base';

export interface SabworkerlyDailyHours {
    mon?: number;
    tue?: number;
    wed?: number;
    thu?: number;
    fri?: number;
    sat?: number;
    sun?: number;
}

export interface SabworkerlyTimesheetDoc {
    _id?: string;
    userId: string;
    placementId: string;
    workerId: string;
    /** ISO date — Monday 00:00 UTC of the timesheet week. */
    weekStart: string;
    dailyHoursJson: SabworkerlyDailyHours;
    totalHours: number;
    /** `draft | submitted | approved | invoiced | rejected`. */
    status: string;
    submittedAt?: string;
    approvedBy?: string;
    approvedAt?: string;
    rejectionReason?: string;
    createdAt: string;
    updatedAt?: string;
}

export interface SabworkerlyTimesheetCreateInput {
    placementId: string;
    workerId: string;
    weekStart: string;
    dailyHoursJson: SabworkerlyDailyHours;
    totalHours: number;
    status?: string;
}

export type SabworkerlyTimesheetUpdateInput = {
    dailyHoursJson?: SabworkerlyDailyHours;
    totalHours?: number;
    status?: string;
};

const baseApi: CrmClient<SabworkerlyTimesheetDoc, SabworkerlyTimesheetCreateInput> =
    makeCrmClient<SabworkerlyTimesheetDoc, SabworkerlyTimesheetCreateInput>(
        '/v1/sabworkerly/timesheets',
    );

export const sabworkerlyTimesheetsApi = {
    ...baseApi,
    async submit(id: string): Promise<SabworkerlyTimesheetDoc> {
        return rustFetch<SabworkerlyTimesheetDoc>(
            `/v1/sabworkerly/timesheets/${encodeURIComponent(id)}/submit`,
            { method: 'POST', body: '{}' },
        );
    },
    async approve(id: string): Promise<SabworkerlyTimesheetDoc> {
        return rustFetch<SabworkerlyTimesheetDoc>(
            `/v1/sabworkerly/timesheets/${encodeURIComponent(id)}/approve`,
            { method: 'POST', body: '{}' },
        );
    },
    async reject(id: string, reason?: string): Promise<SabworkerlyTimesheetDoc> {
        return rustFetch<SabworkerlyTimesheetDoc>(
            `/v1/sabworkerly/timesheets/${encodeURIComponent(id)}/reject`,
            { method: 'POST', body: JSON.stringify({ reason: reason ?? '' }) },
        );
    },
};
