import 'server-only';

/**
 * CRM Automations client — wraps `/v1/crm/automations`.
 */
import { rustFetch } from './fetcher';

export type CrmAutomationStatus = 'draft' | 'active' | 'paused' | 'archived';

export interface CrmAutomationNodePosition {
  x: number;
  y: number;
}

export interface CrmAutomationNodeDoc {
  id: string;
  type: string;
  data?: unknown;
  position: CrmAutomationNodePosition;
}

export interface CrmAutomationEdgeDoc {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
}

export interface CrmAutomationDoc {
  _id: string;
  userId?: string;
  name: string;
  description?: string;
  nodes: CrmAutomationNodeDoc[];
  edges: CrmAutomationEdgeDoc[];
  status: CrmAutomationStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmAutomationListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmAutomationStatus | 'all';
}

export interface CrmAutomationListResponse {
  items: CrmAutomationDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmAutomationCreateInput {
  name: string;
  description?: string;
  nodes?: CrmAutomationNodeDoc[];
  edges?: CrmAutomationEdgeDoc[];
  status?: CrmAutomationStatus;
}

export type CrmAutomationUpdateInput = Partial<CrmAutomationCreateInput> & {
  status?: CrmAutomationStatus;
};

function buildListQuery(p?: CrmAutomationListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmAutomationsApi = {
  list: (params?: CrmAutomationListParams) =>
    rustFetch<CrmAutomationListResponse>(
      `/v1/crm/automations${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmAutomationDoc>(
      `/v1/crm/automations/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmAutomationCreateInput) =>
    rustFetch<{ id: string; entity: CrmAutomationDoc }>(
      '/v1/crm/automations',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: CrmAutomationUpdateInput) =>
    rustFetch<CrmAutomationDoc>(
      `/v1/crm/automations/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/automations/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
