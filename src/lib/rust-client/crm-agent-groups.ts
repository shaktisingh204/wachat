import 'server-only';

/**
 * CRM Agent Groups client — wraps `/v1/crm/agent-groups`.
 *
 * An agent group is a support team: a bundle of agent user-ids with a
 * manager, assignment strategy, and optional shared inbox / business
 * hours reference. Used by ticketing and chat routing.
 */
import { rustFetch } from './fetcher';

export type CrmAgentGroupStatus = 'active' | 'archived';

export type CrmAgentGroupAssignmentStrategy =
  | 'round_robin'
  | 'load_balanced'
  | 'manual'
  | 'sticky';

export interface CrmAgentGroupDoc {
  _id: string;
  userId?: string;
  name: string;
  description?: string;
  email?: string;
  memberIds?: string[];
  memberCount?: number;
  managerId?: string;
  assignmentStrategy?: CrmAgentGroupAssignmentStrategy | string;
  businessHoursId?: string;
  isActive: boolean;
  status: CrmAgentGroupStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmAgentGroupListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmAgentGroupStatus | 'all';
  assignmentStrategy?: CrmAgentGroupAssignmentStrategy | string;
  isActive?: boolean;
  managerId?: string;
}

export interface CrmAgentGroupListResponse {
  items: CrmAgentGroupDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmAgentGroupCreateInput {
  name: string;
  description?: string;
  email?: string;
  memberIds?: string[];
  managerId?: string;
  assignmentStrategy?: CrmAgentGroupAssignmentStrategy | string;
  businessHoursId?: string;
  isActive?: boolean;
}

export type CrmAgentGroupUpdateInput = Partial<CrmAgentGroupCreateInput> & {
  status?: CrmAgentGroupStatus;
};

function buildListQuery(p?: CrmAgentGroupListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.assignmentStrategy)
    qs.set('assignmentStrategy', p.assignmentStrategy);
  if (p.isActive != null) qs.set('isActive', String(p.isActive));
  if (p.managerId) qs.set('managerId', p.managerId);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmAgentGroupsApi = {
  list: (params?: CrmAgentGroupListParams) =>
    rustFetch<CrmAgentGroupListResponse>(
      `/v1/crm/agent-groups${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmAgentGroupDoc>(
      `/v1/crm/agent-groups/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmAgentGroupCreateInput) =>
    rustFetch<{ id: string; entity: CrmAgentGroupDoc }>(
      '/v1/crm/agent-groups',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: CrmAgentGroupUpdateInput) =>
    rustFetch<CrmAgentGroupDoc>(
      `/v1/crm/agent-groups/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/agent-groups/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
