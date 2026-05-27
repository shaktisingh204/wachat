import 'server-only';

/**
 * SabWorkerly Placements client — wraps `/v1/sabworkerly/placements`.
 */

import { makeCrmClient, type CrmClient } from './crm-base';

export interface SabworkerlyPlacementDoc {
    _id?: string;
    userId: string;
    jobId: string;
    workerId: string;
    startDate: string;
    endDate?: string;
    hourlyChargeRateMinor: number;
    hourlyPayRateMinor: number;
    /** `active | completed | cancelled`. */
    status: string;
    createdAt: string;
    updatedAt?: string;
}

export interface SabworkerlyPlacementCreateInput {
    jobId: string;
    workerId: string;
    startDate: string;
    endDate?: string;
    hourlyChargeRateMinor: number;
    hourlyPayRateMinor: number;
    status?: string;
}

export type SabworkerlyPlacementUpdateInput = Partial<SabworkerlyPlacementCreateInput>;

export const sabworkerlyPlacementsApi: CrmClient<SabworkerlyPlacementDoc, SabworkerlyPlacementCreateInput> =
    makeCrmClient<SabworkerlyPlacementDoc, SabworkerlyPlacementCreateInput>(
        '/v1/sabworkerly/placements',
    );
