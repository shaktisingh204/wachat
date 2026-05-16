import 'server-only';

/**
 * CRM SLAs client — wraps `/v1/crm/slas`.
 */
import { rustFetch } from './fetcher';

export type CrmSlaStatus = 'active' | 'archived';
export type CrmSlaPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface CrmSlaDoc {
  _id: string;
  userId?: string;
  name: string;
  priority: CrmSlaPriority | string;
  severity?: string;
  channel?: string;
  firstResponseMinutes: number;
  resolutionMinutes: number;
  businessHoursOnly?: boolean;
  escalateTo?: string;
  escalateAfterMinutes?: number;
  description?: string;
  notes?: string;
  status: CrmSlaStatus;
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmSlaListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmSlaStatus | 'all';
  priority?: CrmSlaPriority | string;
}

export interface CrmSlaListResponse {
  items: CrmSlaDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmSlaCreateInput {
  name: string;
  priority?: CrmSlaPriority | string;
  severity?: string;
  channel?: string;
  firstResponseMinutes: number;
  resolutionMinutes: number;
  businessHoursOnly?: boolean;
  escalateTo?: string;
  escalateAfterMinutes?: number;
  description?: string;
  notes?: string;
}

export type CrmSlaUpdateInput = Partial<CrmSlaCreateInput> & {
  status?: CrmSlaStatus;
  active?: boolean;
};

function buildListQuery(p?: CrmSlaListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.priority) qs.set('priority', p.priority);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmSlasApi = {
  list: (params?: CrmSlaListParams) =>
    rustFetch<CrmSlaListResponse>(`/v1/crm/slas${buildListQuery(params)}`),
  getById: (id: string) =>
    rustFetch<CrmSlaDoc>(`/v1/crm/slas/${encodeURIComponent(id)}`),
  create: (input: CrmSlaCreateInput) =>
    rustFetch<{ id: string; entity: CrmSlaDoc }>('/v1/crm/slas', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: CrmSlaUpdateInput) =>
    rustFetch<CrmSlaDoc>(`/v1/crm/slas/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(`/v1/crm/slas/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
};
