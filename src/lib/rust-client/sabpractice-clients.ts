import 'server-only';

/**
 * SabPractice Client client — wraps `/v1/sabpractice/clients`.
 * Mirrors `sabpractice-clients::types::SabPracticeClient`.
 */

import { makeCrmClient, type CrmClient } from './crm-base';

export interface SabPracticeBooksLinkRef {
    system: string;
    accountId?: string;
    externalUrl?: string;
    note?: string;
}

export interface SabPracticeClientDoc {
    _id?: string;
    userId: string;
    firmId?: string;
    name: string;
    industry?: string;
    fiscalYearStart?: string;
    primaryContactName?: string;
    primaryContactEmail?: string;
    primaryContactPhone?: string;
    address?: string;
    taxId?: string;
    registrationNo?: string;
    website?: string;
    timezone?: string;
    currency?: string;
    notes?: string;
    status?: string;
    booksLinkRef?: SabPracticeBooksLinkRef;
    assignedAdvisorUserIds?: string[];
    tags?: string[];
    createdAt: string;
    updatedAt?: string;
}

export interface SabPracticeClientCreateInput {
    name: string;
    firmId?: string;
    industry?: string;
    fiscalYearStart?: string;
    primaryContactName?: string;
    primaryContactEmail?: string;
    primaryContactPhone?: string;
    address?: string;
    taxId?: string;
    registrationNo?: string;
    website?: string;
    timezone?: string;
    currency?: string;
    notes?: string;
    status?: string;
    booksLinkRef?: SabPracticeBooksLinkRef;
    assignedAdvisorUserIds?: string[];
    tags?: string[];
}

export type SabPracticeClientUpdateInput = Partial<SabPracticeClientCreateInput>;

export const sabpracticeClientsApi: CrmClient<SabPracticeClientDoc, SabPracticeClientCreateInput> =
    makeCrmClient<SabPracticeClientDoc, SabPracticeClientCreateInput>('/v1/sabpractice/clients');
