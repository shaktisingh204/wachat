import 'server-only';

/**
 * CRM Ticket Types client — wraps `/v1/crm/ticket-types`.
 *
 * Taxonomy of ticket types per tenant (e.g. "Bug", "Feature", "Question",
 * "Incident"). Names are unique per tenant (excluding archived) and at most
 * one type may be marked as the default.
 */
import { rustFetch } from './fetcher';

export type CrmTicketTypeStatus = 'active' | 'archived';

export interface CrmTicketTypeDoc {
  _id: string;
  userId?: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  defaultPriority?: string;
  defaultSlaId?: string;
  defaultGroupId?: string;
  requiredFields?: string[];
  isActive: boolean;
  isDefault: boolean;
  status: CrmTicketTypeStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmTicketTypeListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmTicketTypeStatus | 'all';
  isActive?: boolean;
  isDefault?: boolean;
}

export interface CrmTicketTypeListResponse {
  items: CrmTicketTypeDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmTicketTypeCreateInput {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  defaultPriority?: string;
  defaultSlaId?: string;
  defaultGroupId?: string;
  requiredFields?: string[];
  isActive?: boolean;
  isDefault?: boolean;
}

export type CrmTicketTypeUpdateInput = Partial<CrmTicketTypeCreateInput> & {
  status?: CrmTicketTypeStatus;
};

function buildListQuery(p?: CrmTicketTypeListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.isActive != null) qs.set('isActive', String(p.isActive));
  if (p.isDefault != null) qs.set('isDefault', String(p.isDefault));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmTicketTypesApi = {
  list: (params?: CrmTicketTypeListParams) =>
    rustFetch<CrmTicketTypeListResponse>(
      `/v1/crm/ticket-types${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmTicketTypeDoc>(
      `/v1/crm/ticket-types/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmTicketTypeCreateInput) =>
    rustFetch<{ id: string; entity: CrmTicketTypeDoc }>(
      '/v1/crm/ticket-types',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: CrmTicketTypeUpdateInput) =>
    rustFetch<CrmTicketTypeDoc>(
      `/v1/crm/ticket-types/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/ticket-types/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
