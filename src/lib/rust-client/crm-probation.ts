import 'server-only';

/**
 * CRM HR Probation client — wraps `/v1/crm/probations`.
 *
 * The Rust `crm-probation` crate uses `#[serde(rename_all = "camelCase")]`
 * on both its types and DTOs (per Employee Transitions §2), so the
 * camelCase TS field names match the wire contract exactly.
 */
import { rustFetch } from './fetcher';

export type ProbationStatus =
  | 'in_progress'
  | 'confirmed'
  | 'extended'
  | 'terminated'
  | 'archived';

export type ProbationRecommendation = 'confirm' | 'extend' | 'terminate';

export interface ProbationCriterion {
  name: string;
  target?: string;
  achieved?: string;
  score?: number;
}

export interface CrmProbationDoc {
  _id: string;
  userId?: string;
  employeeId?: string;
  employeeName?: string;
  startDate?: string;
  endDate?: string;
  evaluatorId?: string;
  evaluatorName?: string;
  criteria: ProbationCriterion[];
  overallScore?: number;
  recommendation?: ProbationRecommendation;
  notes?: string;
  status: ProbationStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmProbationListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: ProbationStatus | 'all';
  employeeId?: string;
}

export interface CrmProbationListResponse {
  items: CrmProbationDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmProbationCreateInput {
  employeeId?: string;
  employeeName?: string;
  /** RFC3339 date-time string. */
  startDate?: string;
  /** RFC3339 date-time string. */
  endDate?: string;
  evaluatorId?: string;
  evaluatorName?: string;
  criteria?: ProbationCriterion[];
  overallScore?: number;
  recommendation?: ProbationRecommendation;
  notes?: string;
  status?: ProbationStatus;
}

export type CrmProbationUpdateInput = Partial<CrmProbationCreateInput>;

function buildListQuery(p?: CrmProbationListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.employeeId) qs.set('employeeId', p.employeeId);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmProbationsApi = {
  list: (params?: CrmProbationListParams) =>
    rustFetch<CrmProbationListResponse>(
      `/v1/crm/probations${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmProbationDoc>(
      `/v1/crm/probations/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmProbationCreateInput) =>
    rustFetch<{ id: string; entity: CrmProbationDoc }>(
      '/v1/crm/probations',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: CrmProbationUpdateInput) =>
    rustFetch<CrmProbationDoc>(
      `/v1/crm/probations/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/probations/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
