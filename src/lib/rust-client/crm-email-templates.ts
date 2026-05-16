import 'server-only';

/**
 * CRM Email Templates client — wraps `/v1/crm/email-templates`.
 */
import { rustFetch } from './fetcher';

export type CrmEmailTemplateStatus = 'active' | 'archived';

export interface CrmEmailTemplateDoc {
  _id: string;
  userId?: string;
  name: string;
  subject: string;
  body: string;
  textBody?: string;
  category?: string;
  variables?: string[];
  isActive: boolean;
  status: CrmEmailTemplateStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmEmailTemplateListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmEmailTemplateStatus | 'all';
  category?: string;
  isActive?: boolean;
}

export interface CrmEmailTemplateListResponse {
  items: CrmEmailTemplateDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmEmailTemplateCreateInput {
  name: string;
  subject: string;
  body: string;
  textBody?: string;
  category?: string;
  variables?: string[];
  isActive?: boolean;
}

export type CrmEmailTemplateUpdateInput = Partial<CrmEmailTemplateCreateInput> & {
  status?: CrmEmailTemplateStatus;
};

function buildListQuery(p?: CrmEmailTemplateListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.category) qs.set('category', p.category);
  if (p.isActive != null) qs.set('isActive', String(p.isActive));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmEmailTemplatesApi = {
  list: (params?: CrmEmailTemplateListParams) =>
    rustFetch<CrmEmailTemplateListResponse>(
      `/v1/crm/email-templates${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmEmailTemplateDoc>(
      `/v1/crm/email-templates/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmEmailTemplateCreateInput) =>
    rustFetch<{ id: string; entity: CrmEmailTemplateDoc }>(
      '/v1/crm/email-templates',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: CrmEmailTemplateUpdateInput) =>
    rustFetch<CrmEmailTemplateDoc>(
      `/v1/crm/email-templates/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/email-templates/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
