import 'server-only';

/**
 * SabPractice Document Request client — wraps
 * `/v1/sabpractice/document-requests`. File refs are SabFiles ids (the
 * `requestedFiles[].fileId` field is bound after a SabFiles upload).
 */

import { makeCrmClient, type CrmClient } from './crm-base';

export interface SabPracticeRequestedFile {
    name: string;
    status?: string;
    fileId?: string;
    fileUrl?: string;
    note?: string;
    uploadedAt?: string;
}

export interface SabPracticeDocumentRequestDoc {
    _id?: string;
    userId: string;
    clientId: string;
    engagementId?: string;
    title: string;
    description?: string;
    dueDate?: string;
    status?: string;
    requestedFiles?: SabPracticeRequestedFile[];
    createdAt: string;
    updatedAt?: string;
}

export interface SabPracticeDocumentRequestCreateInput {
    clientId: string;
    engagementId?: string;
    title: string;
    description?: string;
    dueDate?: string;
    status?: string;
    requestedFiles?: SabPracticeRequestedFile[];
}

export type SabPracticeDocumentRequestUpdateInput = Partial<SabPracticeDocumentRequestCreateInput>;

export const sabpracticeDocumentRequestsApi: CrmClient<
    SabPracticeDocumentRequestDoc,
    SabPracticeDocumentRequestCreateInput
> = makeCrmClient<SabPracticeDocumentRequestDoc, SabPracticeDocumentRequestCreateInput>(
    '/v1/sabpractice/document-requests',
);
