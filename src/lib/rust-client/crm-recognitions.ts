import 'server-only';

/**
 * CRM HR Recognitions client — wraps `/v1/crm/recognitions`.
 *
 * The Rust `crm-recognitions` crate uses `#[serde(rename_all = "camelCase")]`
 * on both its types and DTOs, so camelCase TS field names match the wire
 * contract exactly.
 */
import { rustFetch } from './fetcher';

export type CrmRecognitionCategory =
  | 'achievement'
  | 'teamwork'
  | 'leadership'
  | 'innovation'
  | 'customer_service'
  | 'other';

export type CrmRecognitionStatus =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'archived';

export interface CrmRecognitionDoc {
  _id: string;
  userId?: string;
  fromEmployeeId?: string;
  fromEmployeeName?: string;
  toEmployeeId?: string;
  toEmployeeName?: string;
  category?: CrmRecognitionCategory;
  message?: string;
  badgeUrl?: string;
  points?: number;
  isPublic?: boolean;
  awardProgramId?: string;
  status?: CrmRecognitionStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmRecognitionListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmRecognitionStatus | 'all';
  category?: CrmRecognitionCategory;
  isPublic?: boolean;
}

export interface CrmRecognitionListResponse {
  items: CrmRecognitionDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmRecognitionCreateInput {
  fromEmployeeId?: string;
  fromEmployeeName?: string;
  toEmployeeId?: string;
  toEmployeeName: string;
  category?: CrmRecognitionCategory;
  message: string;
  badgeUrl?: string;
  points?: number;
  isPublic?: boolean;
  awardProgramId?: string;
  status?: CrmRecognitionStatus;
}

export type CrmRecognitionUpdateInput = Partial<
  Omit<CrmRecognitionCreateInput, 'toEmployeeName' | 'message'>
> & {
  toEmployeeName?: string;
  message?: string;
};

function buildListQuery(p?: CrmRecognitionListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.category) qs.set('category', p.category);
  if (p.isPublic != null) qs.set('isPublic', String(p.isPublic));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmRecognitionsApi = {
  list: (params?: CrmRecognitionListParams) =>
    rustFetch<CrmRecognitionListResponse>(
      `/v1/crm/recognitions${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmRecognitionDoc>(
      `/v1/crm/recognitions/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmRecognitionCreateInput) =>
    rustFetch<{ id: string; entity: CrmRecognitionDoc }>(
      '/v1/crm/recognitions',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: CrmRecognitionUpdateInput) =>
    rustFetch<CrmRecognitionDoc>(
      `/v1/crm/recognitions/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/recognitions/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
