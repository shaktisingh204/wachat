import 'server-only';

/**
 * SabWorkerly Invoices client — wraps `/v1/sabworkerly/invoices`.
 */

import { makeCrmClient, type CrmClient } from './crm-base';

export interface SabworkerlyInvoiceLine {
    placementId: string;
    workerName: string;
    hours: number;
    /** Hourly charge rate, minor units. */
    rate: number;
    /** hours × rate, minor units. */
    amountMinor: number;
}

export interface SabworkerlyInvoiceDoc {
    _id?: string;
    userId: string;
    clientId: string;
    periodStart: string;
    periodEnd: string;
    timesheetIds: string[];
    lineItems: SabworkerlyInvoiceLine[];
    totalMinor: number;
    currency: string;
    /** `draft | sent | paid | overdue`. */
    status: string;
    sentAt?: string;
    paidAt?: string;
    createdAt: string;
    updatedAt?: string;
}

export interface SabworkerlyInvoiceCreateInput {
    clientId: string;
    periodStart: string;
    periodEnd: string;
    timesheetIds: string[];
    lineItems: SabworkerlyInvoiceLine[];
    totalMinor: number;
    currency?: string;
    status?: string;
}

export type SabworkerlyInvoiceUpdateInput = {
    status?: string;
    sentAt?: string;
    paidAt?: string;
};

export const sabworkerlyInvoicesApi: CrmClient<SabworkerlyInvoiceDoc, SabworkerlyInvoiceCreateInput> =
    makeCrmClient<SabworkerlyInvoiceDoc, SabworkerlyInvoiceCreateInput>(
        '/v1/sabworkerly/invoices',
    );
