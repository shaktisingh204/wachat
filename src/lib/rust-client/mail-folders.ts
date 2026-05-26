import 'server-only';

/**
 * Hosted Mail — folder client. Wraps `/v1/mail/folders`.
 * Mirrors `rust/crates/mail-folders/src/types.rs::MailFolder`.
 */

import { makeCrmClient, type CrmClient } from './crm-base';

export type MailFolderType =
    | 'inbox'
    | 'sent'
    | 'drafts'
    | 'trash'
    | 'spam'
    | 'custom';

export interface MailFolderDoc {
    _id?: string;
    userId: string;
    accountId: string;
    name: string;
    parentId?: string;
    type: MailFolderType;
    unreadCount?: number;
    totalCount?: number;
    status?: 'active' | 'archived';
    createdAt: string;
    updatedAt?: string;
}

export interface MailFolderCreateInput {
    accountId: string;
    name: string;
    parentId?: string;
    folderType?: MailFolderType;
}

export type MailFolderUpdateInput = {
    name?: string;
    parentId?: string;
    status?: 'active' | 'archived';
};

export const mailFolderApi: CrmClient<MailFolderDoc, MailFolderCreateInput> =
    makeCrmClient<MailFolderDoc, MailFolderCreateInput>('/v1/mail/folders');
