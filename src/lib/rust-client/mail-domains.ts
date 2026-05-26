import 'server-only';

/**
 * Hosted Mail — domain client. Wraps `/v1/mail/domains` on the Rust BFF.
 * Mirrors `rust/crates/mail-domains/src/types.rs::MailDomain`.
 */

import { makeCrmClient, type CrmClient } from './crm-base';

export interface MailDomainDoc {
    _id?: string;
    userId: string;
    ownerUserId: string;
    domain: string;
    mxStatus?: 'pending' | 'verified' | 'failed';
    spfStatus?: 'pending' | 'verified' | 'failed';
    dmarcStatus?: 'pending' | 'verified' | 'failed';
    dkimSelector?: string;
    dkimPublicKey?: string;
    dkimStatus?: 'pending' | 'verified' | 'failed';
    mailboxQuota?: number;
    mailboxCount?: number;
    createdAt: string;
    updatedAt?: string;
    status?: 'active' | 'archived';
}

export interface MailDomainCreateInput {
    domain: string;
    mailboxQuota?: number;
}

export type MailDomainUpdateInput = Partial<MailDomainDoc>;

export const mailDomainApi: CrmClient<MailDomainDoc, MailDomainCreateInput> =
    makeCrmClient<MailDomainDoc, MailDomainCreateInput>('/v1/mail/domains');
