import 'server-only';

/**
 * SabPublish locations client — wraps `/v1/sabpublish/locations`.
 * Counterpart of the Rust crate `sabpublish-locations`.
 */
import { rustFetch } from './fetcher';

export interface SabpublishLocationDoc {
  _id: string;
  userId?: string;
  name: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  lat?: number;
  lng?: number;
  phone?: string;
  websiteUrl?: string;
  hoursJson?: string;
  categories?: string[];
  status?: 'draft' | 'active' | 'paused' | 'archived';
  createdAt?: string;
  updatedAt?: string;
}

export interface SabpublishLocationListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: 'draft' | 'active' | 'paused' | 'archived' | 'all';
}

export interface SabpublishLocationListResponse {
  items: SabpublishLocationDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface SabpublishLocationCreateInput {
  name: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  lat?: number;
  lng?: number;
  phone?: string;
  websiteUrl?: string;
  hoursJson?: string;
  categories?: string[];
  status?: SabpublishLocationDoc['status'];
}

export type SabpublishLocationUpdateInput = Partial<SabpublishLocationCreateInput>;

function buildListQuery(p?: SabpublishLocationListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const sabpublishLocationsApi = {
  list: (params?: SabpublishLocationListParams) =>
    rustFetch<SabpublishLocationListResponse>(
      `/v1/sabpublish/locations${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<SabpublishLocationDoc>(
      `/v1/sabpublish/locations/${encodeURIComponent(id)}`,
    ),
  create: (input: SabpublishLocationCreateInput) =>
    rustFetch<{ id: string; entity: SabpublishLocationDoc }>(
      '/v1/sabpublish/locations',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: SabpublishLocationUpdateInput) =>
    rustFetch<SabpublishLocationDoc>(
      `/v1/sabpublish/locations/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/sabpublish/locations/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
