import 'server-only';

/**
 * CRM Onboarding client — wraps `/v1/crm/onboarding`.
 *
 * HR new-hire onboarding workflows (W9 paperwork, IT setup, training
 * checklist, buddy/manager assignment, progress tracking).
 */
import { rustFetch } from './fetcher';

export type CrmOnboardingStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'archived';

export type CrmOnboardingTaskStatus =
  | 'todo'
  | 'in_progress'
  | 'done'
  | 'blocked';

export interface CrmOnboardingTask {
  id: string;
  title: string;
  description?: string;
  category?: string;
  assigneeId?: string;
  dueDate?: string;
  status: CrmOnboardingTaskStatus;
  completedAt?: string;
}

export interface CrmOnboardingDoc {
  _id: string;
  userId?: string;
  employeeId?: string;
  employeeName?: string;
  candidateId?: string;
  jobId?: string;
  joiningDate?: string;
  buddyId?: string;
  managerId?: string;
  departmentId?: string;
  checklist?: CrmOnboardingTask[];
  progress?: number;
  notes?: string;
  status: CrmOnboardingStatus;
  completedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmOnboardingListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmOnboardingStatus | 'all';
  employeeId?: string;
}

export interface CrmOnboardingListResponse {
  items: CrmOnboardingDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmOnboardingCreateInput {
  employeeId?: string;
  employeeName?: string;
  candidateId?: string;
  jobId?: string;
  joiningDate?: string;
  buddyId?: string;
  managerId?: string;
  departmentId?: string;
  checklist?: CrmOnboardingTask[];
  progress?: number;
  notes?: string;
  status?: CrmOnboardingStatus;
}

export type CrmOnboardingUpdateInput = Partial<CrmOnboardingCreateInput>;

function buildListQuery(p?: CrmOnboardingListParams): string {
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

export const crmOnboardingApi = {
  list: (params?: CrmOnboardingListParams) =>
    rustFetch<CrmOnboardingListResponse>(
      `/v1/crm/onboarding${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmOnboardingDoc>(
      `/v1/crm/onboarding/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmOnboardingCreateInput) =>
    rustFetch<{ id: string; entity: CrmOnboardingDoc }>(
      '/v1/crm/onboarding',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: CrmOnboardingUpdateInput) =>
    rustFetch<CrmOnboardingDoc>(
      `/v1/crm/onboarding/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/onboarding/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
