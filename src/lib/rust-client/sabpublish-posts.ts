import 'server-only';

/**
 * SabPublish posts client — wraps `/v1/sabpublish/posts`.
 * Counterpart of the Rust crate `sabpublish-posts`.
 */
import { rustFetch } from './fetcher';

export type SabpublishPostStatus = 'draft' | 'scheduled' | 'published' | 'failed';

export interface SabpublishPostDoc {
  _id: string;
  userId?: string;
  locationId: string;
  providerIds?: string[];
  body: string;
  mediaFileIds?: string[];
  scheduleAt?: string;
  status: SabpublishPostStatus;
  publishedAt?: string;
  errorMessage?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SabpublishPostListParams {
  locationId?: string;
  status?: SabpublishPostStatus;
  limit?: number;
}

export interface SabpublishPostCreateInput {
  locationId: string;
  body: string;
  providerIds?: string[];
  mediaFileIds?: string[];
  scheduleAtMs?: number;
  status?: SabpublishPostStatus;
}

export interface SabpublishPostUpdateInput {
  body?: string;
  providerIds?: string[];
  mediaFileIds?: string[];
  scheduleAtMs?: number;
  status?: SabpublishPostStatus;
  errorMessage?: string;
  markPublished?: boolean;
}

function buildQuery(p?: SabpublishPostListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.locationId) qs.set('locationId', p.locationId);
  if (p.status) qs.set('status', p.status);
  if (p.limit != null) qs.set('limit', String(p.limit));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const sabpublishPostsApi = {
  list: (params?: SabpublishPostListParams) =>
    rustFetch<{ items: SabpublishPostDoc[] }>(
      `/v1/sabpublish/posts${buildQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<SabpublishPostDoc>(
      `/v1/sabpublish/posts/${encodeURIComponent(id)}`,
    ),
  create: (input: SabpublishPostCreateInput) =>
    rustFetch<{ id: string; entity: SabpublishPostDoc }>(
      '/v1/sabpublish/posts',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: SabpublishPostUpdateInput) =>
    rustFetch<SabpublishPostDoc>(
      `/v1/sabpublish/posts/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/sabpublish/posts/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
