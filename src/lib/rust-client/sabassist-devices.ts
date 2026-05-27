import 'server-only';

/**
 * SabAssist Devices client — wraps `/v1/sabassist/devices`.
 *
 * Registered unattended endpoints (kiosks, office desktops, …) that the
 * SabAssist agent runs on. Used to drive unattended-mode sessions.
 */
import { rustFetch } from './fetcher';

export interface SabassistDeviceDoc {
  _id: string;
  userId?: string;
  label: string;
  ownerUserId: string;
  deviceFingerprint: string;
  lastSeenAt?: string;
  online: boolean;
  agentVersion?: string;
  osInfoJson?: unknown;
  createdAt?: string;
  updatedAt?: string;
}

export interface SabassistDeviceListParams {
  page?: number;
  limit?: number;
  q?: string;
  online?: boolean;
}

export interface SabassistDeviceListResponse {
  items: SabassistDeviceDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface SabassistDeviceCreateInput {
  label: string;
  ownerUserId?: string;
  deviceFingerprint: string;
  agentVersion?: string;
  osInfoJson?: unknown;
}

export interface SabassistDeviceUpdateInput {
  label?: string;
  ownerUserId?: string;
  agentVersion?: string;
  osInfoJson?: unknown;
  online?: boolean;
  lastSeenAt?: string;
}

function buildListQuery(p?: SabassistDeviceListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.online != null) qs.set('online', String(p.online));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const sabassistDevicesApi = {
  list: (params?: SabassistDeviceListParams) =>
    rustFetch<SabassistDeviceListResponse>(
      `/v1/sabassist/devices${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<SabassistDeviceDoc>(
      `/v1/sabassist/devices/${encodeURIComponent(id)}`,
    ),
  create: (input: SabassistDeviceCreateInput) =>
    rustFetch<{ id: string; entity: SabassistDeviceDoc }>(
      '/v1/sabassist/devices',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: SabassistDeviceUpdateInput) =>
    rustFetch<SabassistDeviceDoc>(
      `/v1/sabassist/devices/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/sabassist/devices/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
