import 'server-only';

/**
 * CRM Sales Proposals client — wraps `/v1/crm/proposals`.
 *
 * Mirrors `rust/crates/crm-proposals/src/types.rs` + `dto.rs`. Field
 * names are camelCase to match the BSON `rename_all` convention.
 */
import { rustFetch } from './fetcher';

export type CrmProposalStatus =
    | 'draft'
    | 'sent'
    | 'accepted'
    | 'rejected'
    | 'expired'
    | 'archived';

export interface CrmProposalSection {
    heading: string;
    body: string;
}

export interface CrmProposalAttachment {
    url: string;
    name: string;
}

export interface CrmProposalAttachmentInput {
    url: string;
    name?: string;
}

export interface CrmProposalDoc {
    _id: string;
    userId?: string;
    proposalNumber: string;
    title: string;
    accountId?: string;
    currency: string;
    totalAmount: number;
    validUntil?: string;
    status: string;
    sections?: CrmProposalSection[];
    attachments?: CrmProposalAttachment[];
    designMetadata?: Record<string, unknown>;
    signsCount?: number;
    sentAt?: string;
    respondedAt?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface CrmProposalListParams {
    page?: number;
    limit?: number;
    q?: string;
    status?: CrmProposalStatus | 'all';
}

export interface CrmProposalListResponse {
    items: CrmProposalDoc[];
    page: number;
    limit: number;
    hasMore: boolean;
}

export interface CrmProposalCreateInput {
    title: string;
    accountId?: string;
    currency?: string;
    totalAmount?: number;
    /** ISO-8601 date/datetime. */
    validUntil?: string;
    status?: CrmProposalStatus;
    sections?: CrmProposalSection[];
    attachments?: CrmProposalAttachmentInput[];
    designMetadata?: Record<string, unknown>;
}

export type CrmProposalUpdateInput = Partial<CrmProposalCreateInput>;

function buildListQuery(p?: CrmProposalListParams): string {
    if (!p) return '';
    const qs = new URLSearchParams();
    if (p.page != null) qs.set('page', String(p.page));
    if (p.limit != null) qs.set('limit', String(p.limit));
    if (p.q) qs.set('q', p.q);
    if (p.status) qs.set('status', p.status);
    const s = qs.toString();
    return s ? `?${s}` : '';
}

export const crmProposalsApi = {
    list: (params?: CrmProposalListParams) =>
        rustFetch<CrmProposalListResponse>(
            `/v1/crm/proposals${buildListQuery(params)}`,
        ),
    getById: (id: string) =>
        rustFetch<CrmProposalDoc>(
            `/v1/crm/proposals/${encodeURIComponent(id)}`,
        ),
    create: (input: CrmProposalCreateInput) =>
        rustFetch<{ id: string; entity: CrmProposalDoc }>(
            '/v1/crm/proposals',
            {
                method: 'POST',
                body: JSON.stringify(input),
            },
        ),
    update: (id: string, patch: CrmProposalUpdateInput) =>
        rustFetch<CrmProposalDoc>(
            `/v1/crm/proposals/${encodeURIComponent(id)}`,
            {
                method: 'PATCH',
                body: JSON.stringify(patch),
            },
        ),
    delete: (id: string) =>
        rustFetch<{ deleted: boolean }>(
            `/v1/crm/proposals/${encodeURIComponent(id)}`,
            { method: 'DELETE' },
        ),
};
