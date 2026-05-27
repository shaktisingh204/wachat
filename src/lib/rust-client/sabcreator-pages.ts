import 'server-only';

/**
 * SabCreator Pages client — wraps `/v1/sabcreator/pages`.
 * Mirrors `rust/crates/sabcreator-pages/src/types.rs`.
 */
import { rustFetch } from './fetcher';

export type SabcreatorPageStatus = 'draft' | 'published' | 'archived';

export type SabcreatorPageKind =
  | 'dashboard'
  | 'list'
  | 'detail'
  | 'form'
  | 'chart'
  | 'custom';

export type SabcreatorPageRoleVisibility = 'all' | 'admin' | 'specific';

export interface SabcreatorPageWidget {
  id: string;
  kind: 'kpi' | 'listView' | 'chart' | 'formEmbed' | 'button' | 'text' | string;
  config: Record<string, unknown>;
  layout?: { x: number; y: number; w: number; h: number };
}

export interface SabcreatorPageConfig {
  widgets: SabcreatorPageWidget[];
  filters?: Record<string, unknown>[];
}

export interface SabcreatorPageDoc {
  _id: string;
  userId: string;
  appId: string;
  name: string;
  slug: string;
  kind: SabcreatorPageKind;
  configJson: SabcreatorPageConfig | Record<string, unknown>;
  roleVisibility: SabcreatorPageRoleVisibility;
  allowedRoleIds?: string[];
  status: SabcreatorPageStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface SabcreatorPageListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: SabcreatorPageStatus | 'all' | 'active_visible';
  appId?: string;
  kind?: SabcreatorPageKind;
}

export interface SabcreatorPageListResponse {
  items: SabcreatorPageDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface SabcreatorPageCreateInput {
  appId: string;
  name: string;
  slug?: string;
  kind: SabcreatorPageKind;
  configJson?: SabcreatorPageConfig | Record<string, unknown>;
  roleVisibility?: SabcreatorPageRoleVisibility;
  allowedRoleIds?: string[];
}

export type SabcreatorPageUpdateInput = Partial<Omit<SabcreatorPageCreateInput, 'appId'>> & {
  status?: SabcreatorPageStatus;
};

function buildQuery(p?: SabcreatorPageListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.appId) qs.set('appId', p.appId);
  if (p.kind) qs.set('kind', p.kind);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const sabcreatorPagesApi = {
  list: (params?: SabcreatorPageListParams) =>
    rustFetch<SabcreatorPageListResponse>(`/v1/sabcreator/pages${buildQuery(params)}`),
  getById: (id: string) =>
    rustFetch<SabcreatorPageDoc>(`/v1/sabcreator/pages/${encodeURIComponent(id)}`),
  create: (input: SabcreatorPageCreateInput) =>
    rustFetch<{ id: string; entity: SabcreatorPageDoc }>('/v1/sabcreator/pages', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: SabcreatorPageUpdateInput) =>
    rustFetch<SabcreatorPageDoc>(`/v1/sabcreator/pages/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(`/v1/sabcreator/pages/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
};
