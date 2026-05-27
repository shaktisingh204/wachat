import 'server-only';

/**
 * SabWorkerly Payroll-Runs client — wraps `/v1/sabworkerly/payroll-runs`.
 */

import { makeCrmClient, type CrmClient } from './crm-base';

export interface SabworkerlyPayrollLine {
    workerId: string;
    hours: number;
    /** Hourly pay rate, minor units. */
    rate: number;
    /** hours × rate, minor units. */
    amountMinor: number;
}

export interface SabworkerlyPayrollRunDoc {
    _id?: string;
    userId: string;
    periodStart: string;
    periodEnd: string;
    timesheetIds: string[];
    lineItems: SabworkerlyPayrollLine[];
    totalMinor: number;
    currency: string;
    /** `draft | approved | paid`. */
    status: string;
    processedAt?: string;
    createdAt: string;
    updatedAt?: string;
}

export interface SabworkerlyPayrollRunCreateInput {
    periodStart: string;
    periodEnd: string;
    timesheetIds: string[];
    lineItems: SabworkerlyPayrollLine[];
    totalMinor: number;
    currency?: string;
    status?: string;
}

export type SabworkerlyPayrollRunUpdateInput = {
    status?: string;
    processedAt?: string;
};

export const sabworkerlyPayrollRunsApi: CrmClient<SabworkerlyPayrollRunDoc, SabworkerlyPayrollRunCreateInput> =
    makeCrmClient<SabworkerlyPayrollRunDoc, SabworkerlyPayrollRunCreateInput>(
        '/v1/sabworkerly/payroll-runs',
    );
