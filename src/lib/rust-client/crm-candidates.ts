import 'server-only';

/**
 * CRM Candidates client — wraps `/v1/crm/candidates`.
 */
import { rustFetch } from './fetcher';

export type CrmCandidateStage =
  | 'applied'
  | 'screening'
  | 'interview'
  | 'offer'
  | 'hired'
  | 'rejected'
  | 'archived';

export type CrmCandidateSource =
  | 'linkedin'
  | 'referral'
  | 'website'
  | 'agency';

export interface CrmCandidateDoc {
  _id: string;
  userId?: string;
  firstName: string;
  lastName?: string;
  email: string;
  phone?: string;
  currentCompany?: string;
  currentTitle?: string;
  location?: string;
  source?: CrmCandidateSource | string;
  jobId?: string;
  resumeUrl?: string;
  coverLetter?: string;
  skills?: string[];
  experienceYears?: number;
  expectedSalary?: number;
  currency?: string;
  stage: CrmCandidateStage;
  rating?: number;
  notes?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmCandidateListParams {
  page?: number;
  limit?: number;
  q?: string;
  stage?: CrmCandidateStage | 'all';
  jobId?: string;
  source?: CrmCandidateSource | string;
}

export interface CrmCandidateListResponse {
  items: CrmCandidateDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmCandidateCreateInput {
  firstName: string;
  lastName?: string;
  email: string;
  phone?: string;
  currentCompany?: string;
  currentTitle?: string;
  location?: string;
  source?: CrmCandidateSource | string;
  jobId?: string;
  resumeUrl?: string;
  coverLetter?: string;
  skills?: string[];
  experienceYears?: number;
  expectedSalary?: number;
  currency?: string;
  stage?: CrmCandidateStage;
  rating?: number;
  notes?: string;
  tags?: string[];
}

export type CrmCandidateUpdateInput = Partial<CrmCandidateCreateInput>;

function buildListQuery(p?: CrmCandidateListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.stage) qs.set('stage', p.stage);
  if (p.jobId) qs.set('jobId', p.jobId);
  if (p.source) qs.set('source', p.source);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmCandidatesApi = {
  list: (params?: CrmCandidateListParams) =>
    rustFetch<CrmCandidateListResponse>(
      `/v1/crm/candidates${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmCandidateDoc>(
      `/v1/crm/candidates/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmCandidateCreateInput) =>
    rustFetch<{ id: string; entity: CrmCandidateDoc }>(
      '/v1/crm/candidates',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: CrmCandidateUpdateInput) =>
    rustFetch<CrmCandidateDoc>(
      `/v1/crm/candidates/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/candidates/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
