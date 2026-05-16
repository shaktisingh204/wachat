import 'server-only';

/**
 * CRM Succession Plan client — wraps `/v1/crm/succession-plans`.
 */
import { rustFetch } from './fetcher';

export type CrmSuccessionStatus = 'draft' | 'approved' | 'archived';

export type CrmSuccessionReadinessOverall =
  | 'ready_now'
  | '1_year'
  | '2_3_years';

export interface CrmSuccessionCandidate {
  name: string;
  employeeId?: string;
  readiness?: string;
}

export interface CrmSuccessionPlanDoc {
  _id: string;
  userId?: string;
  roleTitle: string;
  currentIncumbent?: string;
  successors?: CrmSuccessionCandidate[];
  readinessOverall?: CrmSuccessionReadinessOverall;
  criticalRole?: boolean;
  notes?: string;
  status: CrmSuccessionStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmSuccessionListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmSuccessionStatus | 'all';
  readinessOverall?: CrmSuccessionReadinessOverall;
  criticalRole?: boolean;
}

export interface CrmSuccessionListResponse {
  items: CrmSuccessionPlanDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmSuccessionCreateInput {
  roleTitle: string;
  currentIncumbent?: string;
  successors?: CrmSuccessionCandidate[];
  readinessOverall?: CrmSuccessionReadinessOverall;
  criticalRole?: boolean;
  notes?: string;
  status?: CrmSuccessionStatus;
}

export type CrmSuccessionUpdateInput = Partial<CrmSuccessionCreateInput>;

function buildListQuery(p?: CrmSuccessionListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.readinessOverall) qs.set('readinessOverall', p.readinessOverall);
  if (p.criticalRole != null) qs.set('criticalRole', String(p.criticalRole));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmSuccessionApi = {
  list: (params?: CrmSuccessionListParams) =>
    rustFetch<CrmSuccessionListResponse>(
      `/v1/crm/succession-plans${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmSuccessionPlanDoc>(
      `/v1/crm/succession-plans/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmSuccessionCreateInput) =>
    rustFetch<{ id: string; entity: CrmSuccessionPlanDoc }>(
      '/v1/crm/succession-plans',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: CrmSuccessionUpdateInput) =>
    rustFetch<CrmSuccessionPlanDoc>(
      `/v1/crm/succession-plans/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/succession-plans/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
