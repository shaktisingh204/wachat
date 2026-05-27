import 'server-only';

/**
 * SabWorkerly Jobs client — wraps `/v1/sabworkerly/jobs`.
 */

import { makeCrmClient, type CrmClient } from './crm-base';

export interface SabworkerlyJobDoc {
    _id?: string;
    userId: string;
    clientId: string;
    title: string;
    description?: string;
    skillsRequired?: string[];
    shiftPattern?: string;
    hourlyChargeRateMinor: number;
    hourlyPayRateMinor: number;
    currency: string;
    startDate: string;
    endDate?: string;
    /** `open | filled | closed`. */
    status: string;
    createdAt: string;
    updatedAt?: string;
}

export interface SabworkerlyJobCreateInput {
    clientId: string;
    title: string;
    description?: string;
    skillsRequired?: string[];
    shiftPattern?: string;
    hourlyChargeRateMinor: number;
    hourlyPayRateMinor: number;
    currency?: string;
    startDate: string;
    endDate?: string;
    status?: string;
}

export type SabworkerlyJobUpdateInput = Partial<SabworkerlyJobCreateInput>;

export const sabworkerlyJobsApi: CrmClient<SabworkerlyJobDoc, SabworkerlyJobCreateInput> =
    makeCrmClient<SabworkerlyJobDoc, SabworkerlyJobCreateInput>('/v1/sabworkerly/jobs');
