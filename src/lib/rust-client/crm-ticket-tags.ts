import 'server-only';

/**
 * CRM TicketTag client — wraps `/v1/crm/ticket-tags`.
 *
 * Classification labels applied to support tickets. Name is unique per tenant
 * (among non-archived tags). Color + icon are presentation; `ticketsCount` is
 * a denormalized usage counter maintained server-side.
 */
import { rustFetch } from './fetcher';

export type CrmTicketTagStatus = 'active' | 'archived';

export interface CrmTicketTagDoc {
  _id: string;
  userId?: string;
  name: string;
  slug?: string;
  description?: string;
  color?: string;
  icon?: string;
  isActive: boolean;
  status: CrmTicketTagStatus;
  ticketsCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmTicketTagListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmTicketTagStatus | 'all';
  isActive?: boolean;
}

export interface CrmTicketTagListResponse {
  items: CrmTicketTagDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmTicketTagCreateInput {
  name: string;
  slug?: string;
  description?: string;
  color?: string;
  icon?: string;
  isActive?: boolean;
}

export type CrmTicketTagUpdateInput = Partial<CrmTicketTagCreateInput> & {
  status?: CrmTicketTagStatus;
};

function buildListQuery(p?: CrmTicketTagListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.isActive != null) qs.set('isActive', String(p.isActive));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmTicketTagsApi = {
  list: (params?: CrmTicketTagListParams) =>
    rustFetch<CrmTicketTagListResponse>(
      `/v1/crm/ticket-tags${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmTicketTagDoc>(
      `/v1/crm/ticket-tags/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmTicketTagCreateInput) =>
    rustFetch<{ id: string; entity: CrmTicketTagDoc }>(
      '/v1/crm/ticket-tags',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: CrmTicketTagUpdateInput) =>
    rustFetch<CrmTicketTagDoc>(
      `/v1/crm/ticket-tags/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/ticket-tags/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
