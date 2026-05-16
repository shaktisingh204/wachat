import 'server-only';

/**
 * CRM Interviews client — wraps `/v1/crm/interviews`.
 */
import { rustFetch } from './fetcher';

export type CrmInterviewStatus =
  | 'scheduled'
  | 'rescheduled'
  | 'completed'
  | 'no_show'
  | 'cancelled'
  | 'archived';

export type CrmInterviewType =
  | 'phone'
  | 'video'
  | 'onsite'
  | 'async_assessment';

export type CrmInterviewRecommendation =
  | 'strong_hire'
  | 'hire'
  | 'no_hire'
  | 'strong_no_hire';

export interface CrmInterviewDoc {
  _id: string;
  userId?: string;
  candidateId: string;
  candidateName?: string;
  jobId?: string;
  round: number;
  roundName?: string;
  interviewType?: CrmInterviewType | string;
  scheduledAt: string;
  durationMinutes?: number;
  location?: string;
  interviewers?: string[];
  interviewerNames?: string[];
  status: CrmInterviewStatus;
  feedback?: string;
  rating?: number;
  recommendation?: CrmInterviewRecommendation | string;
  completedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmInterviewListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmInterviewStatus | 'all';
  candidateId?: string;
  jobId?: string;
}

export interface CrmInterviewListResponse {
  items: CrmInterviewDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmInterviewCreateInput {
  candidateId: string;
  candidateName?: string;
  jobId?: string;
  round?: number;
  roundName?: string;
  interviewType?: CrmInterviewType | string;
  scheduledAt: string;
  durationMinutes?: number;
  location?: string;
  interviewers?: string[];
  interviewerNames?: string[];
}

export type CrmInterviewUpdateInput = Partial<CrmInterviewCreateInput> & {
  status?: CrmInterviewStatus;
  feedback?: string;
  rating?: number;
  recommendation?: CrmInterviewRecommendation | string;
};

function buildListQuery(p?: CrmInterviewListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.candidateId) qs.set('candidateId', p.candidateId);
  if (p.jobId) qs.set('jobId', p.jobId);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmInterviewsApi = {
  list: (params?: CrmInterviewListParams) =>
    rustFetch<CrmInterviewListResponse>(
      `/v1/crm/interviews${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmInterviewDoc>(
      `/v1/crm/interviews/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmInterviewCreateInput) =>
    rustFetch<{ id: string; entity: CrmInterviewDoc }>(
      '/v1/crm/interviews',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: CrmInterviewUpdateInput) =>
    rustFetch<CrmInterviewDoc>(
      `/v1/crm/interviews/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/interviews/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
