import 'server-only';

/**
 * SabWorkerly Clients client — wraps `/v1/sabworkerly/clients`.
 */

import { makeCrmClient, type CrmClient } from './crm-base';

export interface SabworkerlyClientDoc {
    _id?: string;
    userId: string;
    name: string;
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
    billingAddressJson?: unknown;
    paymentTermsDays: number;
    /** `active | inactive`. */
    status: string;
    createdAt: string;
    updatedAt?: string;
}

export interface SabworkerlyClientCreateInput {
    name: string;
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
    billingAddressJson?: unknown;
    paymentTermsDays?: number;
    status?: string;
}

export type SabworkerlyClientUpdateInput = Partial<SabworkerlyClientCreateInput>;

export const sabworkerlyClientsApi: CrmClient<SabworkerlyClientDoc, SabworkerlyClientCreateInput> =
    makeCrmClient<SabworkerlyClientDoc, SabworkerlyClientCreateInput>(
        '/v1/sabworkerly/clients',
    );
