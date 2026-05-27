import 'server-only';

/**
 * SabPractice Engagement client — wraps `/v1/sabpractice/engagements`.
 */

import { makeCrmClient, type CrmClient } from './crm-base';

export interface SabPracticeEngagementDoc {
    _id?: string;
    userId: string;
    clientId: string;
    name: string;
    scopeJson?: unknown;
    startDate: string;
    endDate?: string;
    status?: string;
    hourlyRateMinor?: number;
    currency?: string;
    billingCadence?: string;
    assignedUserIds?: string[];
    notes?: string;
    createdAt: string;
    updatedAt?: string;
}

export interface SabPracticeEngagementCreateInput {
    clientId: string;
    name: string;
    scopeJson?: unknown;
    startDate: string;
    endDate?: string;
    status?: string;
    hourlyRateMinor?: number;
    currency?: string;
    billingCadence?: string;
    assignedUserIds?: string[];
    notes?: string;
}

export type SabPracticeEngagementUpdateInput = Partial<SabPracticeEngagementCreateInput>;

export const sabpracticeEngagementsApi: CrmClient<
    SabPracticeEngagementDoc,
    SabPracticeEngagementCreateInput
> = makeCrmClient<SabPracticeEngagementDoc, SabPracticeEngagementCreateInput>(
    '/v1/sabpractice/engagements',
);
