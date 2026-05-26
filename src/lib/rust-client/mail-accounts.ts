import 'server-only';

/**
 * Hosted Mail — mailbox account client. Wraps `/v1/mail/accounts`.
 * Mirrors `rust/crates/mail-accounts/src/types.rs::MailAccount`.
 */

import { makeCrmClient, type CrmClient } from './crm-base';

export interface MailAccountDoc {
    _id?: string;
    userId: string;
    domainId: string;
    localPart: string;
    displayName?: string;
    passwordHash?: string;
    quotaMb?: number;
    status?: 'active' | 'suspended' | 'archived';
    emailAddress?: string;
    forwardingAddress?: string;
    createdAt: string;
    updatedAt?: string;
}

export interface MailAccountCreateInput {
    domainId: string;
    localPart: string;
    displayName?: string;
    password?: string;
    quotaMb?: number;
    forwardingAddress?: string;
}

export type MailAccountUpdateInput = {
    displayName?: string;
    password?: string;
    quotaMb?: number;
    forwardingAddress?: string;
    status?: 'active' | 'suspended' | 'archived';
};

export const mailAccountApi: CrmClient<MailAccountDoc, MailAccountCreateInput> =
    makeCrmClient<MailAccountDoc, MailAccountCreateInput>('/v1/mail/accounts');
