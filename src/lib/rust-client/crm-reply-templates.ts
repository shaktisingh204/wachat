import 'server-only';

/**
 * CRM Reply Templates client — wraps `/v1/crm/reply-templates`.
 *
 * Reply templates are canned ticket replies / macro responses keyed by
 * an optional slash-command shortcut, with `{{variable}}` placeholders,
 * category bucketing, and per-language variants.
 */
import { rustFetch } from './fetcher';

export type CrmReplyTemplateStatus = 'active' | 'archived';

export interface CrmReplyTemplateDoc {
  _id: string;
  userId?: string;
  name: string;
  shortcut?: string;
  body: string;
  category?: string;
  language?: string;
  variables?: string[];
  isActive: boolean;
  usageCount: number;
  status: CrmReplyTemplateStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmReplyTemplateListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmReplyTemplateStatus | 'all';
  category?: string;
  language?: string;
  isActive?: boolean;
}

export interface CrmReplyTemplateListResponse {
  items: CrmReplyTemplateDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmReplyTemplateCreateInput {
  name: string;
  body: string;
  shortcut?: string;
  category?: string;
  language?: string;
  variables?: string[];
  isActive?: boolean;
}

export type CrmReplyTemplateUpdateInput = Partial<CrmReplyTemplateCreateInput> & {
  status?: CrmReplyTemplateStatus;
  usageCount?: number;
};

function buildListQuery(p?: CrmReplyTemplateListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.category) qs.set('category', p.category);
  if (p.language) qs.set('language', p.language);
  if (p.isActive != null) qs.set('isActive', String(p.isActive));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmReplyTemplatesApi = {
  list: (params?: CrmReplyTemplateListParams) =>
    rustFetch<CrmReplyTemplateListResponse>(
      `/v1/crm/reply-templates${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmReplyTemplateDoc>(
      `/v1/crm/reply-templates/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmReplyTemplateCreateInput) =>
    rustFetch<{ id: string; entity: CrmReplyTemplateDoc }>(
      '/v1/crm/reply-templates',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: CrmReplyTemplateUpdateInput) =>
    rustFetch<CrmReplyTemplateDoc>(
      `/v1/crm/reply-templates/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/reply-templates/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
