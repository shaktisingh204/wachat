import 'server-only';

/**
 * CRM Form Submissions client — wraps `/v1/crm/form-submissions`.
 */
import { rustFetch } from './fetcher';

export type CrmFormSubmissionStatus =
  | 'new'
  | 'processed'
  | 'spam'
  | 'archived';

export interface CrmFormSubmissionDoc {
  _id: string;
  userId?: string;
  formId: string;
  data?: Record<string, unknown>;
  sourceUrl?: string;
  ipAddress?: string;
  userAgent?: string;
  referrer?: string;
  status: CrmFormSubmissionStatus;
  processedAt?: string;
  notes?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmFormSubmissionListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmFormSubmissionStatus | 'all';
  formId?: string;
}

export interface CrmFormSubmissionListResponse {
  items: CrmFormSubmissionDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmFormSubmissionCreateInput {
  formId: string;
  data?: Record<string, unknown>;
  sourceUrl?: string;
  ipAddress?: string;
  userAgent?: string;
  referrer?: string;
  notes?: string;
  tags?: string[];
}

export type CrmFormSubmissionUpdateInput = Partial<
  Omit<CrmFormSubmissionCreateInput, 'formId'>
> & {
  status?: CrmFormSubmissionStatus;
  processedAt?: string;
};

function buildListQuery(p?: CrmFormSubmissionListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.formId) qs.set('formId', p.formId);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmFormSubmissionsApi = {
  list: (params?: CrmFormSubmissionListParams) =>
    rustFetch<CrmFormSubmissionListResponse>(
      `/v1/crm/form-submissions${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmFormSubmissionDoc>(
      `/v1/crm/form-submissions/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmFormSubmissionCreateInput) =>
    rustFetch<{ id: string; entity: CrmFormSubmissionDoc }>(
      '/v1/crm/form-submissions',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: CrmFormSubmissionUpdateInput) =>
    rustFetch<CrmFormSubmissionDoc>(
      `/v1/crm/form-submissions/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/form-submissions/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
