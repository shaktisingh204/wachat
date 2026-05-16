import 'server-only';

/**
 * CRM Offers client — wraps `/v1/crm/offers`.
 */
import { rustFetch } from './fetcher';

export type CrmOfferStatus =
  | 'draft'
  | 'sent'
  | 'accepted'
  | 'rejected'
  | 'expired'
  | 'withdrawn'
  | 'archived';

export type CrmOfferSalaryPeriod = 'annual' | 'monthly' | 'hourly';

export interface CrmOfferDoc {
  _id: string;
  userId?: string;
  candidateId: string;
  candidateName?: string;
  jobId?: string;
  jobTitle?: string;
  offerLetterUrl?: string;
  salaryAmount: number;
  salaryCurrency?: string;
  salaryPeriod: CrmOfferSalaryPeriod;
  bonus?: number;
  equity?: string;
  benefits?: string[];
  joiningDate?: string;
  expiresAt?: string;
  notes?: string;
  status: CrmOfferStatus;
  sentAt?: string;
  respondedAt?: string;
  responseNotes?: string;
  approverId?: string;
  approvedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmOfferListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmOfferStatus | 'all';
  candidateId?: string;
  jobId?: string;
}

export interface CrmOfferListResponse {
  items: CrmOfferDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmOfferCreateInput {
  candidateId: string;
  candidateName?: string;
  jobId?: string;
  jobTitle?: string;
  offerLetterUrl?: string;
  salaryAmount: number;
  salaryCurrency?: string;
  salaryPeriod?: CrmOfferSalaryPeriod;
  bonus?: number;
  equity?: string;
  benefits?: string[];
  joiningDate?: string;
  expiresAt?: string;
  notes?: string;
  approverId?: string;
}

export type CrmOfferUpdateInput = Partial<Omit<CrmOfferCreateInput, 'candidateId'>> & {
  status?: CrmOfferStatus;
  responseNotes?: string;
};

function buildListQuery(p?: CrmOfferListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.candidateId) qs.set('candidateId', p.candidateId);
  if (p.jobId) qs.set('jobId', p.jobId);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmOffersApi = {
  list: (params?: CrmOfferListParams) =>
    rustFetch<CrmOfferListResponse>(`/v1/crm/offers${buildListQuery(params)}`),
  getById: (id: string) =>
    rustFetch<CrmOfferDoc>(`/v1/crm/offers/${encodeURIComponent(id)}`),
  create: (input: CrmOfferCreateInput) =>
    rustFetch<{ id: string; entity: CrmOfferDoc }>('/v1/crm/offers', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: CrmOfferUpdateInput) =>
    rustFetch<CrmOfferDoc>(`/v1/crm/offers/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(`/v1/crm/offers/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
};
