import 'server-only';

import { rustFetch } from './fetcher';

export interface SablensFrameDoc {
  _id: string;
  userId?: string;
  sessionId: string;
  ts: string;
  fileId: string;
  deviceOrientation?: number;
  sensorInfoJson?: Record<string, unknown>;
  createdAt?: string;
}

export interface SablensFrameListParams {
  sessionId?: string;
  page?: number;
  limit?: number;
}

export interface SablensFrameListResponse {
  items: SablensFrameDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface SablensFrameCreateInput {
  sessionId: string;
  fileId: string;
  deviceOrientation?: number;
  sensorInfoJson?: Record<string, unknown>;
}

function buildListQuery(p?: SablensFrameListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.sessionId) qs.set('sessionId', p.sessionId);
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const sablensFramesApi = {
  list: (params?: SablensFrameListParams) =>
    rustFetch<SablensFrameListResponse>(
      `/v1/sablens/frames${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<SablensFrameDoc>(
      `/v1/sablens/frames/${encodeURIComponent(id)}`,
    ),
  create: (input: SablensFrameCreateInput) =>
    rustFetch<{ id: string; entity: SablensFrameDoc }>(
      '/v1/sablens/frames',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/sablens/frames/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
