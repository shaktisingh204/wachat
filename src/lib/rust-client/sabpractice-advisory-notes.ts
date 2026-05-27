import 'server-only';

/**
 * SabPractice Advisory Note client — wraps `/v1/sabpractice/advisory-notes`.
 * Extends the standard CRUD with a `share` action that flips status to
 * `shared` + stamps `sharedAt`.
 */

import { makeCrmClient, type CrmClient } from './crm-base';
import { rustFetch } from './fetcher';

export interface SabPracticeAdvisoryNoteDoc {
    _id?: string;
    userId: string;
    clientId: string;
    engagementId?: string;
    authorUserId: string;
    title: string;
    body: string;
    kind?: string;
    status?: string;
    sharedAt?: string;
    tags?: string[];
    createdAt: string;
    updatedAt?: string;
}

export interface SabPracticeAdvisoryNoteCreateInput {
    clientId: string;
    engagementId?: string;
    authorUserId: string;
    title: string;
    body: string;
    kind?: string;
    status?: string;
    tags?: string[];
}

export type SabPracticeAdvisoryNoteUpdateInput = Partial<
    Omit<SabPracticeAdvisoryNoteCreateInput, 'clientId' | 'authorUserId'>
>;

const base: CrmClient<SabPracticeAdvisoryNoteDoc, SabPracticeAdvisoryNoteCreateInput> =
    makeCrmClient<SabPracticeAdvisoryNoteDoc, SabPracticeAdvisoryNoteCreateInput>(
        '/v1/sabpractice/advisory-notes',
    );

export const sabpracticeAdvisoryNotesApi = {
    ...base,
    async share(id: string): Promise<SabPracticeAdvisoryNoteDoc> {
        return rustFetch<SabPracticeAdvisoryNoteDoc>(
            `/v1/sabpractice/advisory-notes/${encodeURIComponent(id)}/share`,
            { method: 'POST' },
        );
    },
};
