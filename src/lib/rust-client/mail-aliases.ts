import 'server-only';

/**
 * Hosted Mail — alias client. Wraps `/v1/mail/aliases`.
 * Mirrors `rust/crates/mail-aliases/src/types.rs::MailAlias`.
 */

import { makeCrmClient, type CrmClient } from './crm-base';

export interface MailAliasDoc {
    _id?: string;
    userId: string;
    domainId: string;
    sourceAddress: string;
    targetAccountIds?: string[];
    externalTargets?: string[];
    status?: 'active' | 'archived';
    createdAt: string;
    updatedAt?: string;
}

export interface MailAliasCreateInput {
    domainId: string;
    sourceAddress: string;
    targetAccountIds?: string[];
    externalTargets?: string[];
}

export type MailAliasUpdateInput = Partial<MailAliasCreateInput> & {
    status?: 'active' | 'archived';
};

export const mailAliasApi: CrmClient<MailAliasDoc, MailAliasCreateInput> =
    makeCrmClient<MailAliasDoc, MailAliasCreateInput>('/v1/mail/aliases');
