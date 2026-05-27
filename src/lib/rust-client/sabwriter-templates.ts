import 'server-only';

/**
 * SabWriter templates client — wraps `/v1/sabwriter/templates`.
 */
import { rustFetch } from './fetcher';
import type { SabwriterContentJson } from './sabwriter-documents';

export interface SabwriterTemplateDoc {
  _id: string;
  userId?: string;
  name: string;
  description?: string;
  category?: string;
  contentJson: SabwriterContentJson;
  public?: boolean;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt?: string;
}

export interface TemplateListParams {
  page?: number;
  limit?: number;
  q?: string;
  category?: string;
  scope?: 'mine' | 'public' | 'all';
}

export interface TemplateListResponse {
  items: SabwriterTemplateDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CreateTemplateInput {
  name: string;
  contentJson: SabwriterContentJson;
  description?: string;
  category?: string;
  public?: boolean;
}

export type UpdateTemplateInput = Partial<{
  name: string;
  description: string;
  category: string;
  contentJson: SabwriterContentJson;
  public: boolean;
  status: 'active' | 'archived';
}>;

function qs(p?: TemplateListParams): string {
  if (!p) return '';
  const u = new URLSearchParams();
  if (p.page != null) u.set('page', String(p.page));
  if (p.limit != null) u.set('limit', String(p.limit));
  if (p.q) u.set('q', p.q);
  if (p.category) u.set('category', p.category);
  if (p.scope) u.set('scope', p.scope);
  const s = u.toString();
  return s ? `?${s}` : '';
}

export const sabwriterTemplatesApi = {
  list: (p?: TemplateListParams) =>
    rustFetch<TemplateListResponse>(`/v1/sabwriter/templates${qs(p)}`),
  getById: (id: string) =>
    rustFetch<SabwriterTemplateDoc>(
      `/v1/sabwriter/templates/${encodeURIComponent(id)}`,
    ),
  create: (input: CreateTemplateInput) =>
    rustFetch<{ id: string; entity: SabwriterTemplateDoc }>(
      '/v1/sabwriter/templates',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: UpdateTemplateInput) =>
    rustFetch<SabwriterTemplateDoc>(
      `/v1/sabwriter/templates/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/sabwriter/templates/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
