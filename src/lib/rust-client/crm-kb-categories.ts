import 'server-only';

/**
 * CRM KB Categories client — wraps `/v1/crm/kb-categories`.
 *
 * Counterpart of the Rust crate `crm-kb-categories`. Categories nest via
 * `parentId` (adjacency list). The UI builds the tree from a single
 * list call and groups in JS — there's no nested endpoint.
 */
import { rustFetch } from './fetcher';

/* ─── Wire types — mirror crm_kb_categories::types::CrmKbCategory ── */

export type CrmKbCategoryStatus = 'active' | 'archived';
export type CrmKbCategoryVisibility = 'internal' | 'portal' | 'public';

export interface CrmKbCategoryDoc {
  _id: string;
  userId?: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  parentId?: string | null;
  order?: number;
  visibility?: CrmKbCategoryVisibility | string;
  articleCount?: number;
  status?: CrmKbCategoryStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmKbCategoryListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmKbCategoryStatus | 'all';
  visibility?: CrmKbCategoryVisibility;
  /** Use the literal `"root"` to fetch top-level categories. */
  parentId?: string | 'root';
}

export interface CrmKbCategoryListResponse {
  items: CrmKbCategoryDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmKbCategoryCreateInput {
  name: string;
  slug?: string;
  description?: string;
  icon?: string;
  parentId?: string;
  order?: number;
  visibility?: CrmKbCategoryVisibility;
}

export type CrmKbCategoryUpdateInput = Partial<CrmKbCategoryCreateInput> & {
  status?: CrmKbCategoryStatus;
  articleCount?: number;
};

function buildListQuery(p?: CrmKbCategoryListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.visibility) qs.set('visibility', p.visibility);
  if (p.parentId) qs.set('parentId', p.parentId);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmKbCategoriesApi = {
  list: (params?: CrmKbCategoryListParams) =>
    rustFetch<CrmKbCategoryListResponse>(
      `/v1/crm/kb-categories${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmKbCategoryDoc>(
      `/v1/crm/kb-categories/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmKbCategoryCreateInput) =>
    rustFetch<{ id: string; entity: CrmKbCategoryDoc }>(
      '/v1/crm/kb-categories',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: CrmKbCategoryUpdateInput) =>
    rustFetch<CrmKbCategoryDoc>(
      `/v1/crm/kb-categories/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/kb-categories/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
