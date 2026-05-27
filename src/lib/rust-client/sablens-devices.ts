import 'server-only';

import { rustFetch } from './fetcher';

export interface SablensDeviceDoc {
  _id: string;
  userId?: string;
  label: string;
  deviceFingerprint: string;
  ownerUserId?: string;
  lastSeenAt?: string;
  online: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SablensDeviceListParams {
  page?: number;
  limit?: number;
  q?: string;
  online?: boolean;
}

export interface SablensDeviceListResponse {
  items: SablensDeviceDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface SablensDeviceRegisterInput {
  label: string;
  deviceFingerprint: string;
  ownerUserId?: string;
}

export interface SablensDeviceUpdateInput {
  label?: string;
  ownerUserId?: string;
  online?: boolean;
}

function buildListQuery(p?: SablensDeviceListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.online != null) qs.set('online', String(p.online));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const sablensDevicesApi = {
  list: (params?: SablensDeviceListParams) =>
    rustFetch<SablensDeviceListResponse>(
      `/v1/sablens/devices${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<SablensDeviceDoc>(
      `/v1/sablens/devices/${encodeURIComponent(id)}`,
    ),
  register: (input: SablensDeviceRegisterInput) =>
    rustFetch<{ id: string; entity: SablensDeviceDoc }>(
      '/v1/sablens/devices',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: SablensDeviceUpdateInput) =>
    rustFetch<SablensDeviceDoc>(
      `/v1/sablens/devices/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/sablens/devices/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
  heartbeat: (id: string) =>
    rustFetch<SablensDeviceDoc>(
      `/v1/sablens/devices/${encodeURIComponent(id)}/heartbeat`,
      { method: 'POST', body: '{}' },
    ),
};
