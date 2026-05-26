import 'server-only';

/**
 * SabShop Theme client — wraps `/v1/sabshop/themes`.
 */
import { rustFetch } from './fetcher';

export interface SabshopThemeDoc {
  _id: string;
  userId?: string;
  name: string;
  description?: string;
  configJson?: unknown;
  system?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SabshopThemeListResponse {
  items: SabshopThemeDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface SabshopThemeCreateInput {
  name: string;
  description?: string;
  configJson?: unknown;
}

export type SabshopThemeUpdateInput = Partial<SabshopThemeCreateInput>;

export const sabshopThemesApi = {
  list: (params?: { page?: number; limit?: number; q?: string }) => {
    const qs = new URLSearchParams();
    if (params?.page != null) qs.set('page', String(params.page));
    if (params?.limit != null) qs.set('limit', String(params.limit));
    if (params?.q) qs.set('q', params.q);
    const s = qs.toString();
    return rustFetch<SabshopThemeListResponse>(
      `/v1/sabshop/themes${s ? `?${s}` : ''}`,
    );
  },
  getById: (id: string) =>
    rustFetch<SabshopThemeDoc>(`/v1/sabshop/themes/${encodeURIComponent(id)}`),
  create: (input: SabshopThemeCreateInput) =>
    rustFetch<{ id: string; entity: SabshopThemeDoc }>(`/v1/sabshop/themes`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: SabshopThemeUpdateInput) =>
    rustFetch<SabshopThemeDoc>(`/v1/sabshop/themes/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(`/v1/sabshop/themes/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
};
