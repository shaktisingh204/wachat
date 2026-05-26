import 'server-only';

/**
 * Hosted Mail — message client. Wraps `/v1/mail/messages`.
 * Mirrors `rust/crates/mail-messages/src/types.rs::MailMessage`.
 *
 * Raw `.eml` body + attachments live in SabFiles; this only stores refs.
 */

import { makeCrmClient, type CrmClient } from './crm-base';

export interface MailAddressWire {
    name?: string;
    email: string;
}

export interface MailMessageDoc {
    _id?: string;
    userId: string;
    accountId: string;
    folderId: string;
    uid?: number;
    messageId?: string;
    subject?: string;
    fromAddr?: MailAddressWire;
    toAddrs?: MailAddressWire[];
    cc?: MailAddressWire[];
    bcc?: MailAddressWire[];
    replyTo?: MailAddressWire[];
    receivedAt?: string;
    sentAt?: string;
    bodyFileId?: string;
    attachmentFileIds?: string[];
    snippet?: string;
    unread: boolean;
    starred: boolean;
    labels?: string[];
    threadId?: string;
    createdAt: string;
    updatedAt?: string;
}

export interface MailMessageCreateInput {
    accountId: string;
    folderId: string;
    subject?: string;
    fromAddr?: MailAddressWire;
    toAddrs?: MailAddressWire[];
    cc?: MailAddressWire[];
    bcc?: MailAddressWire[];
    bodyFileId?: string;
    attachmentFileIds?: string[];
    snippet?: string;
    labels?: string[];
    threadId?: string;
    unread?: boolean;
}

export interface MailMessageUpdateInput {
    folderId?: string;
    unread?: boolean;
    starred?: boolean;
    labels?: string[];
}

export const mailMessageApi: CrmClient<MailMessageDoc, MailMessageCreateInput> =
    makeCrmClient<MailMessageDoc, MailMessageCreateInput>('/v1/mail/messages');
