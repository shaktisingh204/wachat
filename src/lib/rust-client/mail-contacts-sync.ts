import 'server-only';

/**
 * Hosted Mail — webmail address book. Wraps `/v1/mail/contacts-sync`.
 * Mirrors `rust/crates/mail-contacts-sync/src/types.rs::MailContact`.
 */

import { makeCrmClient, type CrmClient } from './crm-base';

export interface MailContactDoc {
    _id?: string;
    userId: string;
    accountId: string;
    displayName?: string;
    emails?: string[];
    lastUsedAt?: string;
    sendCount?: number;
    receiveCount?: number;
    status?: 'active' | 'archived';
    createdAt: string;
    updatedAt?: string;
}

export interface MailContactCreateInput {
    accountId: string;
    displayName?: string;
    emails: string[];
}

export interface MailContactUpdateInput {
    displayName?: string;
    emails?: string[];
    status?: 'active' | 'archived';
}

export const mailContactApi: CrmClient<MailContactDoc, MailContactCreateInput> =
    makeCrmClient<MailContactDoc, MailContactCreateInput>('/v1/mail/contacts-sync');
