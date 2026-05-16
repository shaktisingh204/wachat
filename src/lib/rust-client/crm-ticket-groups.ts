import 'server-only';

/**
 * CRM TicketGroup client — wraps `/v1/crm/ticket-groups`.
 *
 * Hierarchical categorization buckets for support tickets. `name` is unique
 * per tenant among non-archived groups. A group may carry a parent group, a
 * default assignee, and a default SLA, plus presentation (color, icon).
 * `ticketsCount` is a denormalized usage counter maintained server-side.
 */
import { rustFetch } from './fetcher';

export type CrmTicketGroupStatus = 'active' | 'archived';

export interface CrmTicketGroupDoc {
  _id: string;
  userId?: string;
  name: string;
  description?: string;
  parentGroupId?: string;
  defaultAssigneeId?: string;
  defaultSlaId?: string;
  color?: string;
  icon?: string;
  isActive: boolean;
  ticketsCount: number;
  status: CrmTicketGroupStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmTicketGroupListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmTicketGroupStatus | 'all';
  isActive?: boolean;
  parentGroupId?: string;
}

export interface CrmTicketGroupListResponse {
  items: CrmTicketGroupDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmTicketGroupCreateInput {
  name: string;
  description?: string;
  parentGroupId?: string;
  defaultAssigneeId?: string;
  defaultSlaId?: string;
  color?: string;
  icon?: string;
  isActive?: boolean;
}

export type CrmTicketGroupUpdateInput = Partial<CrmTicketGroupCreateInput> & {
  status?: CrmTicketGroupStatus;
};

function buildListQuery(p?: CrmTicketGroupListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.isActive != null) qs.set('isActive', String(p.isActive));
  if (p.parentGroupId) qs.set('parentGroupId', p.parentGroupId);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmTicketGroupsApi = {
  list: (params?: CrmTicketGroupListParams) =>
    rustFetch<CrmTicketGroupListResponse>(
      `/v1/crm/ticket-groups${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmTicketGroupDoc>(
      `/v1/crm/ticket-groups/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmTicketGroupCreateInput) =>
    rustFetch<{ id: string; entity: CrmTicketGroupDoc }>(
      '/v1/crm/ticket-groups',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: CrmTicketGroupUpdateInput) =>
    rustFetch<CrmTicketGroupDoc>(
      `/v1/crm/ticket-groups/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/ticket-groups/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
