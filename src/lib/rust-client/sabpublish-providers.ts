import 'server-only';

/**
 * SabPublish providers client — wraps `/v1/sabpublish/providers`.
 * Counterpart of the Rust crate `sabpublish-providers`.
 */
import { rustFetch } from './fetcher';

export type SabpublishProviderId =
  | 'gbp'
  | 'yelp'
  | 'bing'
  | 'apple'
  | 'facebook';

export type SabpublishProviderConnectionStatus =
  | 'not_connected'
  | 'connected'
  | 'error';

export interface SabpublishProviderDoc {
  _id: string;
  userId?: string;
  locationId: string;
  providerId: SabpublishProviderId | string;
  connectionStatus: SabpublishProviderConnectionStatus;
  externalListingId?: string;
  lastSyncAt?: string;
  credentialsRef?: string;
  errorMessage?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SabpublishProviderListParams {
  locationId?: string;
  providerId?: string;
}

export interface SabpublishProviderUpsertInput {
  locationId: string;
  providerId: SabpublishProviderId | string;
  connectionStatus?: SabpublishProviderConnectionStatus;
  externalListingId?: string;
  credentialsRef?: string;
  errorMessage?: string;
}

export interface SabpublishProviderUpdateInput {
  connectionStatus?: SabpublishProviderConnectionStatus;
  externalListingId?: string;
  credentialsRef?: string;
  errorMessage?: string;
  lastSyncAtMs?: number;
}

function buildQuery(p?: SabpublishProviderListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.locationId) qs.set('locationId', p.locationId);
  if (p.providerId) qs.set('providerId', p.providerId);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const sabpublishProvidersApi = {
  list: (params?: SabpublishProviderListParams) =>
    rustFetch<{ items: SabpublishProviderDoc[] }>(
      `/v1/sabpublish/providers${buildQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<SabpublishProviderDoc>(
      `/v1/sabpublish/providers/${encodeURIComponent(id)}`,
    ),
  upsert: (input: SabpublishProviderUpsertInput) =>
    rustFetch<{ id: string; entity: SabpublishProviderDoc }>(
      '/v1/sabpublish/providers',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: SabpublishProviderUpdateInput) =>
    rustFetch<SabpublishProviderDoc>(
      `/v1/sabpublish/providers/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/sabpublish/providers/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
