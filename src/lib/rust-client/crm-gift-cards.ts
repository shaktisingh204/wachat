import 'server-only';

/**
 * CRM Gift Card client — wraps `/v1/crm/gift-cards`.
 */
import { rustFetch } from './fetcher';

export type CrmGiftCardStatus = 'active' | 'redeemed' | 'expired' | 'archived';

export interface CrmGiftCardDoc {
  _id: string;
  userId?: string;
  code: string;
  value: number;
  balance: number;
  issuedTo?: string;
  issuedToEmail?: string;
  expiryDate?: string;
  transferable?: boolean;
  status?: CrmGiftCardStatus;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmGiftCardListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmGiftCardStatus | 'all';
}

export interface CrmGiftCardListResponse {
  items: CrmGiftCardDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmGiftCardCreateInput {
  code?: string;
  value: number;
  issuedTo?: string;
  issuedToEmail?: string;
  expiryDate?: string;
  transferable?: boolean;
  notes?: string;
}

export type CrmGiftCardUpdateInput = Partial<
  Omit<CrmGiftCardCreateInput, 'value'> & {
    value: number;
    balance: number;
    status: CrmGiftCardStatus;
  }
>;

function buildListQuery(p?: CrmGiftCardListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmGiftCardsApi = {
  list: (params?: CrmGiftCardListParams) =>
    rustFetch<CrmGiftCardListResponse>(
      `/v1/crm/gift-cards${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmGiftCardDoc>(`/v1/crm/gift-cards/${encodeURIComponent(id)}`),
  create: (input: CrmGiftCardCreateInput) =>
    rustFetch<{ id: string; entity: CrmGiftCardDoc }>('/v1/crm/gift-cards', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: CrmGiftCardUpdateInput) =>
    rustFetch<CrmGiftCardDoc>(`/v1/crm/gift-cards/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/gift-cards/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
