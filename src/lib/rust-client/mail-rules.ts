import 'server-only';

/**
 * Hosted Mail — server-side filter rules. Wraps `/v1/mail/rules`.
 * Mirrors `rust/crates/mail-rules/src/types.rs::MailRule`.
 */

import { makeCrmClient, type CrmClient } from './crm-base';

export type MailRuleConditionField =
    | 'from'
    | 'to'
    | 'subject'
    | 'body'
    | 'hasAttachment';

export type MailRuleConditionOp =
    | 'equals'
    | 'contains'
    | 'startsWith'
    | 'endsWith'
    | 'regex'
    | 'isTrue'
    | 'isFalse';

export interface MailRuleCondition {
    field: MailRuleConditionField;
    op: MailRuleConditionOp;
    value?: string;
}

export type MailRuleActionType =
    | 'move'
    | 'label'
    | 'forward'
    | 'delete'
    | 'markRead'
    | 'star';

export interface MailRuleAction {
    type: MailRuleActionType;
    value?: string;
}

export interface MailRuleDoc {
    _id?: string;
    userId: string;
    accountId: string;
    name: string;
    priority?: number;
    matchMode?: 'all' | 'any';
    conditions?: MailRuleCondition[];
    actions?: MailRuleAction[];
    enabled?: boolean;
    status?: 'active' | 'archived';
    createdAt: string;
    updatedAt?: string;
}

export interface MailRuleCreateInput {
    accountId: string;
    name: string;
    priority?: number;
    matchMode?: 'all' | 'any';
    conditions?: MailRuleCondition[];
    actions?: MailRuleAction[];
    enabled?: boolean;
}

export type MailRuleUpdateInput = Partial<Omit<MailRuleCreateInput, 'accountId'>> & {
    status?: 'active' | 'archived';
};

export const mailRuleApi: CrmClient<MailRuleDoc, MailRuleCreateInput> =
    makeCrmClient<MailRuleDoc, MailRuleCreateInput>('/v1/mail/rules');
