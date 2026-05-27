import 'server-only';

/**
 * SabPractice Task client — wraps `/v1/sabpractice/tasks`.
 */

import { makeCrmClient, type CrmClient } from './crm-base';

export interface SabPracticeTaskDoc {
    _id?: string;
    userId: string;
    clientId: string;
    engagementId: string;
    title: string;
    description?: string;
    assigneeUserId?: string;
    dueDate?: string;
    status?: string;
    priority?: string;
    billable?: boolean;
    hoursSpent?: number;
    tags?: string[];
    createdAt: string;
    updatedAt?: string;
}

export interface SabPracticeTaskCreateInput {
    clientId: string;
    engagementId: string;
    title: string;
    description?: string;
    assigneeUserId?: string;
    dueDate?: string;
    status?: string;
    priority?: string;
    billable?: boolean;
    hoursSpent?: number;
    tags?: string[];
}

export type SabPracticeTaskUpdateInput = Partial<SabPracticeTaskCreateInput>;

export const sabpracticeTasksApi: CrmClient<SabPracticeTaskDoc, SabPracticeTaskCreateInput> =
    makeCrmClient<SabPracticeTaskDoc, SabPracticeTaskCreateInput>('/v1/sabpractice/tasks');
