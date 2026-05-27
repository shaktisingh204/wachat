import 'server-only';

/**
 * SabPractice Firm client — wraps `/v1/sabpractice/firms` on the Rust BFF.
 * Mirrors `sabpractice-firms::types::SabPracticeFirm`.
 */

import { makeCrmClient, type CrmClient } from './crm-base';

export interface SabPracticeFirmDoc {
    _id?: string;
    userId: string;
    name: string;
    registrationNo?: string;
    email?: string;
    phone?: string;
    website?: string;
    address?: string;
    timezone?: string;
    currency?: string;
    fiscalYearStartMonth?: number;
    services?: string[];
    status?: string;
    createdAt: string;
    updatedAt?: string;
}

export interface SabPracticeFirmCreateInput {
    name: string;
    registrationNo?: string;
    email?: string;
    phone?: string;
    website?: string;
    address?: string;
    timezone?: string;
    currency?: string;
    fiscalYearStartMonth?: number;
    services?: string[];
    status?: string;
}

export type SabPracticeFirmUpdateInput = Partial<SabPracticeFirmCreateInput>;

export const sabpracticeFirmsApi: CrmClient<SabPracticeFirmDoc, SabPracticeFirmCreateInput> =
    makeCrmClient<SabPracticeFirmDoc, SabPracticeFirmCreateInput>('/v1/sabpractice/firms');
