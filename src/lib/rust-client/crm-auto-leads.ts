import 'server-only';

/**
 * CRM Auto Lead Rules client — wraps `/v1/crm/auto-lead-rules`.
 */
import { rustFetch } from './fetcher';

export type CrmAutoLeadRuleStatus = 'active' | 'paused' | 'archived';

export interface CrmAutoLeadRuleCondition {
  // Flexible blob. Legacy single-condition shape uses { source, keyword, leadSource }.
  // Richer rules add more keys (field, operator, value, channel, etc.).
  [key: string]: unknown;
}

export interface CrmAutoLeadRuleDoc {
  _id: string;
  userId?: string;
  name: string;
  conditions?: CrmAutoLeadRuleCondition[];
  assignToUserId?: string;
  assignToTeam?: string;
  priority?: number;
  executionOrder?: number;
  isActive: boolean;
  status: CrmAutoLeadRuleStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmAutoLeadRuleListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmAutoLeadRuleStatus | 'all';
  isActive?: boolean;
  assignToTeam?: string;
}

export interface CrmAutoLeadRuleListResponse {
  items: CrmAutoLeadRuleDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmAutoLeadRuleCreateInput {
  name: string;
  conditions?: CrmAutoLeadRuleCondition[];
  assignToUserId?: string;
  assignToTeam?: string;
  priority?: number;
  executionOrder?: number;
  isActive?: boolean;
}

export type CrmAutoLeadRuleUpdateInput = Partial<CrmAutoLeadRuleCreateInput> & {
  status?: CrmAutoLeadRuleStatus;
};

function buildListQuery(p?: CrmAutoLeadRuleListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.isActive != null) qs.set('isActive', String(p.isActive));
  if (p.assignToTeam) qs.set('assignToTeam', p.assignToTeam);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmAutoLeadsApi = {
  list: (params?: CrmAutoLeadRuleListParams) =>
    rustFetch<CrmAutoLeadRuleListResponse>(
      `/v1/crm/auto-lead-rules${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmAutoLeadRuleDoc>(
      `/v1/crm/auto-lead-rules/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmAutoLeadRuleCreateInput) =>
    rustFetch<{ id: string; entity: CrmAutoLeadRuleDoc }>(
      '/v1/crm/auto-lead-rules',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: CrmAutoLeadRuleUpdateInput) =>
    rustFetch<CrmAutoLeadRuleDoc>(
      `/v1/crm/auto-lead-rules/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/auto-lead-rules/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
