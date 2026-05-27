import 'server-only';

/**
 * SabCreator Apps client — wraps `/v1/sabcreator/apps`.
 * Mirrors `rust/crates/sabcreator-apps/src/types.rs`.
 */
import { rustFetch } from './fetcher';

export type SabcreatorAppStatus = 'draft' | 'published' | 'archived';

export interface SabcreatorAppDoc {
  _id: string;
  userId: string;
  name: string;
  slug: string;
  description?: string;
  iconFileId?: string;
  sabtablesBaseId?: string;
  status: SabcreatorAppStatus;
  themeJson?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface SabcreatorAppListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: SabcreatorAppStatus | 'all' | 'active_visible';
}

export interface SabcreatorAppListResponse {
  items: SabcreatorAppDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface SabcreatorAppCreateInput {
  name: string;
  slug?: string;
  description?: string;
  iconFileId?: string;
  sabtablesBaseId?: string;
  themeJson?: Record<string, unknown>;
}

export type SabcreatorAppUpdateInput = Partial<SabcreatorAppCreateInput> & {
  status?: SabcreatorAppStatus;
};

function buildQuery(p?: SabcreatorAppListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const sabcreatorAppsApi = {
  list: (params?: SabcreatorAppListParams) =>
    rustFetch<SabcreatorAppListResponse>(`/v1/sabcreator/apps${buildQuery(params)}`),
  getById: (id: string) =>
    rustFetch<SabcreatorAppDoc>(`/v1/sabcreator/apps/${encodeURIComponent(id)}`),
  create: (input: SabcreatorAppCreateInput) =>
    rustFetch<{ id: string; entity: SabcreatorAppDoc }>('/v1/sabcreator/apps', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: SabcreatorAppUpdateInput) =>
    rustFetch<SabcreatorAppDoc>(`/v1/sabcreator/apps/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(`/v1/sabcreator/apps/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
};
