import 'server-only';

/**
 * CRM Voucher Books client — wraps `/v1/crm/voucher-books`.
 */
import { rustFetch } from './fetcher';

export type CrmVoucherBookStatus = 'active' | 'archived';

export interface CrmVoucherBookDoc {
  _id: string;
  userId?: string;
  name: string;
  type: string;
  isDefault?: boolean;
  prefix?: string;
  suffix?: string;
  startingNumber?: number;
  padding?: number;
  resetFrequency?: 'none' | 'yearly' | 'monthly';
  approvalRequired?: boolean;
  isActive?: boolean;
  status?: CrmVoucherBookStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmVoucherBookListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmVoucherBookStatus | 'all';
  type?: string;
}

export interface CrmVoucherBookListResponse {
  items: CrmVoucherBookDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmVoucherBookCreateInput {
  name: string;
  type: string;
  isDefault?: boolean;
  prefix?: string;
  suffix?: string;
  startingNumber?: number;
  padding?: number;
  resetFrequency?: 'none' | 'yearly' | 'monthly';
  approvalRequired?: boolean;
  isActive?: boolean;
}

export type CrmVoucherBookUpdateInput = Partial<CrmVoucherBookCreateInput> & {
  status?: CrmVoucherBookStatus;
};

function buildListQuery(p?: CrmVoucherBookListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.type) qs.set('type', p.type);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmVoucherBooksApi = {
  list: (params?: CrmVoucherBookListParams) =>
    rustFetch<CrmVoucherBookListResponse>(
      `/v1/crm/voucher-books${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmVoucherBookDoc>(
      `/v1/crm/voucher-books/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmVoucherBookCreateInput) =>
    rustFetch<{ id: string; entity: CrmVoucherBookDoc }>(
      '/v1/crm/voucher-books',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: CrmVoucherBookUpdateInput) =>
    rustFetch<CrmVoucherBookDoc>(
      `/v1/crm/voucher-books/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/voucher-books/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
