import 'server-only';

/**
 * SabCheckout recurring-customer index client — wraps
 * `/v1/sabcheckout/customers`. Counterpart of `sabcheckout-customers`.
 */
import { rustFetch } from './fetcher';

export interface SabcheckoutCustomerDoc {
  _id: string;
  userId: string;
  pageId: string;
  externalCustomerRef: string;
  email: string;
  name?: string;
  phone?: string;
  subscriptionIds?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface SabcheckoutCustomerListParams {
  page?: number;
  limit?: number;
  q?: string;
  pageId?: string;
}

export interface SabcheckoutCustomerListResponse {
  items: SabcheckoutCustomerDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface SabcheckoutCustomerUpsertInput {
  pageId: string;
  externalCustomerRef: string;
  email: string;
  name?: string;
  phone?: string;
  subscriptionId?: string;
}

function buildListQuery(p?: SabcheckoutCustomerListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.pageId) qs.set('pageId', p.pageId);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const sabcheckoutCustomersApi = {
  list: (params?: SabcheckoutCustomerListParams) =>
    rustFetch<SabcheckoutCustomerListResponse>(
      `/v1/sabcheckout/customers${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<SabcheckoutCustomerDoc>(
      `/v1/sabcheckout/customers/${encodeURIComponent(id)}`,
    ),
  upsert: (input: SabcheckoutCustomerUpsertInput) =>
    rustFetch<{
      id: string;
      entity: SabcheckoutCustomerDoc;
      created: boolean;
    }>('/v1/sabcheckout/customers/upsert', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
};
