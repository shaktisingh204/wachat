import 'server-only';

/**
 * CRM Jobs client — wraps `/v1/crm/jobs`.
 *
 * HR job openings / requisitions: title, department, employment type,
 * experience + salary range, openings/filled, hiring manager, status.
 */
import { rustFetch } from './fetcher';

export type CrmJobStatus =
  | 'draft'
  | 'open'
  | 'on_hold'
  | 'filled'
  | 'closed'
  | 'archived';

export type CrmJobEmploymentType =
  | 'full_time'
  | 'part_time'
  | 'contract'
  | 'intern'
  | 'temporary';

export type CrmJobRemotePolicy = 'onsite' | 'remote' | 'hybrid';

export interface CrmJobDoc {
  _id: string;
  userId?: string;
  title: string;
  departmentId?: string;
  departmentName?: string;
  description?: string;
  responsibilities?: string;
  requirements?: string;
  employmentType: CrmJobEmploymentType | string;
  experienceMin?: number;
  experienceMax?: number;
  salaryMin?: number;
  salaryMax?: number;
  currency?: string;
  location?: string;
  remotePolicy?: CrmJobRemotePolicy | string;
  openings: number;
  filled: number;
  hiringManagerId?: string;
  publishUrl?: string;
  publishAt?: string;
  closeAt?: string;
  status: CrmJobStatus;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmJobListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmJobStatus | 'all';
  departmentId?: string;
  employmentType?: CrmJobEmploymentType | string;
}

export interface CrmJobListResponse {
  items: CrmJobDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmJobCreateInput {
  title: string;
  departmentId?: string;
  departmentName?: string;
  description?: string;
  responsibilities?: string;
  requirements?: string;
  employmentType?: CrmJobEmploymentType | string;
  experienceMin?: number;
  experienceMax?: number;
  salaryMin?: number;
  salaryMax?: number;
  currency?: string;
  location?: string;
  remotePolicy?: CrmJobRemotePolicy | string;
  openings?: number;
  hiringManagerId?: string;
  publishUrl?: string;
  publishAt?: string;
  closeAt?: string;
  tags?: string[];
}

export type CrmJobUpdateInput = Partial<CrmJobCreateInput> & {
  filled?: number;
  status?: CrmJobStatus;
};

function buildListQuery(p?: CrmJobListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.departmentId) qs.set('departmentId', p.departmentId);
  if (p.employmentType) qs.set('employmentType', p.employmentType);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmJobsApi = {
  list: (params?: CrmJobListParams) =>
    rustFetch<CrmJobListResponse>(`/v1/crm/jobs${buildListQuery(params)}`),
  getById: (id: string) =>
    rustFetch<CrmJobDoc>(`/v1/crm/jobs/${encodeURIComponent(id)}`),
  create: (input: CrmJobCreateInput) =>
    rustFetch<{ id: string; entity: CrmJobDoc }>('/v1/crm/jobs', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: CrmJobUpdateInput) =>
    rustFetch<CrmJobDoc>(`/v1/crm/jobs/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(`/v1/crm/jobs/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
};
