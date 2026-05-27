import 'server-only';

/**
 * SabPractice Deadline client — wraps `/v1/sabpractice/deadlines`.
 * Adds a `file` action that stamps `completedAt`, attaches SabFiles
 * receipt ids, and flips status → `filed`.
 */

import { makeCrmClient, type CrmClient } from './crm-base';
import { rustFetch } from './fetcher';

export interface SabPracticeDeadlineDoc {
    _id?: string;
    userId: string;
    clientId: string;
    engagementId?: string;
    name: string;
    kind?: string;
    dueDate: string;
    recurrence?: string;
    status?: string;
    assignedUserId?: string;
    notes?: string;
    completedAt?: string;
    attachmentFileIds?: string[];
    createdAt: string;
    updatedAt?: string;
}

export interface SabPracticeDeadlineCreateInput {
    clientId: string;
    engagementId?: string;
    name: string;
    kind?: string;
    dueDate: string;
    recurrence?: string;
    status?: string;
    assignedUserId?: string;
    notes?: string;
    attachmentFileIds?: string[];
}

export type SabPracticeDeadlineUpdateInput = Partial<
    Omit<SabPracticeDeadlineCreateInput, 'clientId'>
>;

export interface SabPracticeDeadlineFileInput {
    attachmentFileIds?: string[];
    notes?: string;
}

const base: CrmClient<SabPracticeDeadlineDoc, SabPracticeDeadlineCreateInput> = makeCrmClient<
    SabPracticeDeadlineDoc,
    SabPracticeDeadlineCreateInput
>('/v1/sabpractice/deadlines');

export const sabpracticeDeadlinesApi = {
    ...base,
    async file(
        id: string,
        input: SabPracticeDeadlineFileInput,
    ): Promise<SabPracticeDeadlineDoc> {
        return rustFetch<SabPracticeDeadlineDoc>(
            `/v1/sabpractice/deadlines/${encodeURIComponent(id)}/file`,
            {
                method: 'POST',
                body: JSON.stringify(input ?? {}),
            },
        );
    },
};
