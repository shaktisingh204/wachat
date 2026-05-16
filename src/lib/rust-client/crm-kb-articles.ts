import 'server-only';

/**
 * CRM KB Articles client — wraps `/v1/crm/kb-articles`.
 */
import { rustFetch } from './fetcher';

export type CrmKbArticleStatus = 'draft' | 'published' | 'archived';

export interface CrmKbArticleDoc {
  _id: string;
  userId?: string;
  title: string;
  slug: string;
  body: string;
  category?: string;
  tags?: string[];
  visibility?: 'internal' | 'public' | 'customer';
  status: CrmKbArticleStatus;
  ownerId?: string;
  helpfulCount?: number;
  viewCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmKbArticleListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmKbArticleStatus | 'all';
  category?: string;
  visibility?: 'internal' | 'public' | 'customer';
}

export interface CrmKbArticleListResponse {
  items: CrmKbArticleDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmKbArticleCreateInput {
  title: string;
  body: string;
  slug?: string;
  category?: string;
  tags?: string[];
  visibility?: 'internal' | 'public' | 'customer';
  status?: CrmKbArticleStatus;
  ownerId?: string;
}

export type CrmKbArticleUpdateInput = Partial<CrmKbArticleCreateInput> & {
  helpfulCount?: number;
  viewCount?: number;
};

function buildListQuery(p?: CrmKbArticleListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.category) qs.set('category', p.category);
  if (p.visibility) qs.set('visibility', p.visibility);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmKbArticlesApi = {
  list: (params?: CrmKbArticleListParams) =>
    rustFetch<CrmKbArticleListResponse>(
      `/v1/crm/kb-articles${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmKbArticleDoc>(
      `/v1/crm/kb-articles/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmKbArticleCreateInput) =>
    rustFetch<{ id: string; entity: CrmKbArticleDoc }>('/v1/crm/kb-articles', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: CrmKbArticleUpdateInput) =>
    rustFetch<CrmKbArticleDoc>(
      `/v1/crm/kb-articles/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/kb-articles/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
