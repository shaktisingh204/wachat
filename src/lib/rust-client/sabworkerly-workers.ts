import 'server-only';

/**
 * SabWorkerly Workers client — wraps `/v1/sabworkerly/workers`.
 * Tightly-typed against `sabworkerly-workers::types::SabworkerlyWorker`.
 */

import { makeCrmClient, type CrmClient } from './crm-base';

export interface SabworkerlyWorkerDoc {
    _id?: string;
    userId: string;
    name: string;
    email: string;
    phone?: string;
    skills?: string[];
    availabilityJson?: unknown;
    /** `active | inactive | on_assignment`. */
    status: string;
    hourlyRateMinor: number;
    currency: string;
    addressJson?: unknown;
    /** SabFiles document IDs (ID, visa, certs). */
    documentIds?: string[];
    createdAt: string;
    updatedAt?: string;
}

export interface SabworkerlyWorkerCreateInput {
    name: string;
    email: string;
    phone?: string;
    skills?: string[];
    availabilityJson?: unknown;
    status?: string;
    hourlyRateMinor?: number;
    currency?: string;
    addressJson?: unknown;
    documentIds?: string[];
}

export type SabworkerlyWorkerUpdateInput = Partial<SabworkerlyWorkerCreateInput>;

export const sabworkerlyWorkersApi: CrmClient<SabworkerlyWorkerDoc, SabworkerlyWorkerCreateInput> =
    makeCrmClient<SabworkerlyWorkerDoc, SabworkerlyWorkerCreateInput>(
        '/v1/sabworkerly/workers',
    );
