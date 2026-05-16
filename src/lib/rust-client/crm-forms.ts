import 'server-only';

/**
 * CRM Forms client — wraps `/v1/crm/forms`.
 *
 * Lead-capture forms entity. Each form is a named bundle of
 * field definitions + settings (redirect URL, success message,
 * captcha, mappings) with a `submissionCount` counter and a
 * `status` lifecycle: `draft` -> `published` -> `archived`.
 */
import { rustFetch } from './fetcher';

export type CrmFormStatus = 'draft' | 'published' | 'archived';

export interface CrmFormFieldDef {
  name: string;
  label?: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  mapping?: string;
}

export interface CrmFormDoc {
  _id: string;
  userId?: string;
  name: string;
  slug?: string;
  url?: string;
  fields: CrmFormFieldDef[];
  settings?: Record<string, unknown> | null;
  submissionCount: number;
  status: CrmFormStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmFormsListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmFormStatus | 'all';
}

export interface CrmFormsListResponse {
  items: CrmFormDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmFormCreateInput {
  name: string;
  slug?: string;
  url?: string;
  fields?: CrmFormFieldDef[];
  settings?: Record<string, unknown> | null;
  status?: CrmFormStatus;
}

export type CrmFormUpdateInput = Partial<CrmFormCreateInput>;

function buildListQuery(p?: CrmFormsListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmFormsApi = {
  list: (params?: CrmFormsListParams) =>
    rustFetch<CrmFormsListResponse>(`/v1/crm/forms${buildListQuery(params)}`),
  getById: (id: string) =>
    rustFetch<CrmFormDoc>(`/v1/crm/forms/${encodeURIComponent(id)}`),
  create: (input: CrmFormCreateInput) =>
    rustFetch<{ id: string; entity: CrmFormDoc }>('/v1/crm/forms', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: CrmFormUpdateInput) =>
    rustFetch<CrmFormDoc>(`/v1/crm/forms/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/forms/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
