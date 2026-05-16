import 'server-only';

/**
 * CRM Appraisals client — wraps `/v1/crm/appraisals`.
 */
import { rustFetch } from './fetcher';

export type CrmAppraisalStatus =
  | 'draft'
  | 'submitted'
  | 'finalized'
  | 'archived';

export interface CrmAppraisalKpi {
  kpiId?: string;
  name: string;
  target?: number;
  achieved?: number;
  score?: number;
}

export interface CrmAppraisalReviewDoc {
  _id: string;
  userId?: string;
  employeeName: string;
  employeeId?: string;
  reviewer?: string;
  period?: string;
  kpis?: CrmAppraisalKpi[];
  overallRating?: number;
  comments?: string;
  status: CrmAppraisalStatus;
  finalizedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmAppraisalListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmAppraisalStatus | 'all';
  period?: string;
  employeeId?: string;
}

export interface CrmAppraisalListResponse {
  items: CrmAppraisalReviewDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmAppraisalCreateInput {
  employeeName: string;
  employeeId?: string;
  reviewer?: string;
  period?: string;
  kpis?: CrmAppraisalKpi[];
  overallRating?: number;
  comments?: string;
  status?: CrmAppraisalStatus;
}

export type CrmAppraisalUpdateInput = Partial<CrmAppraisalCreateInput> & {
  finalizedAt?: string;
};

function buildListQuery(p?: CrmAppraisalListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.period) qs.set('period', p.period);
  if (p.employeeId) qs.set('employeeId', p.employeeId);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmAppraisalsApi = {
  list: (params?: CrmAppraisalListParams) =>
    rustFetch<CrmAppraisalListResponse>(
      `/v1/crm/appraisals${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmAppraisalReviewDoc>(
      `/v1/crm/appraisals/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmAppraisalCreateInput) =>
    rustFetch<{ id: string; entity: CrmAppraisalReviewDoc }>(
      '/v1/crm/appraisals',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: CrmAppraisalUpdateInput) =>
    rustFetch<CrmAppraisalReviewDoc>(
      `/v1/crm/appraisals/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/appraisals/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
