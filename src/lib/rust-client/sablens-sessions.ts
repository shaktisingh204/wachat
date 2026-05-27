import 'server-only';

/**
 * SabLens sessions client — wraps `/v1/sablens/sessions` (technician,
 * JWT) and `/v1/sablens/sessions-public` (customer-facing, token only).
 */
import { rustFetch } from './fetcher';

export type SablensSessionStatus =
  | 'scheduled'
  | 'waiting'
  | 'active'
  | 'ended';

export type SablensSessionMode = 'live_call' | 'async_recorded';

export interface SablensSessionDoc {
  _id: string;
  userId?: string;
  technicianUserId: string;
  customerName?: string;
  customerEmail?: string;
  customerJoinToken: string;
  status: SablensSessionStatus;
  mode: SablensSessionMode;
  startedAt?: string;
  endedAt?: string;
  durationSecs?: number;
  recordingFileId?: string;
  snapshotFileIds?: string[];
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SablensSessionListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: SablensSessionStatus;
  mode?: SablensSessionMode;
}

export interface SablensSessionListResponse {
  items: SablensSessionDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface SablensSessionCreateInput {
  technicianUserId?: string;
  customerName?: string;
  customerEmail?: string;
  mode?: SablensSessionMode;
  notes?: string;
}

export interface SablensSessionUpdateInput {
  customerName?: string;
  customerEmail?: string;
  status?: SablensSessionStatus;
  mode?: SablensSessionMode;
  recordingFileId?: string;
  notes?: string;
}

export interface SablensPublicSessionView {
  sessionId: string;
  status: SablensSessionStatus;
  mode: SablensSessionMode;
  technicianName?: string;
  customerName?: string;
}

function buildListQuery(p?: SablensSessionListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.mode) qs.set('mode', p.mode);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const sablensSessionsApi = {
  list: (params?: SablensSessionListParams) =>
    rustFetch<SablensSessionListResponse>(
      `/v1/sablens/sessions${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<SablensSessionDoc>(
      `/v1/sablens/sessions/${encodeURIComponent(id)}`,
    ),
  create: (input: SablensSessionCreateInput) =>
    rustFetch<{ id: string; entity: SablensSessionDoc }>(
      '/v1/sablens/sessions',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: SablensSessionUpdateInput) =>
    rustFetch<SablensSessionDoc>(
      `/v1/sablens/sessions/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/sablens/sessions/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
  start: (id: string) =>
    rustFetch<SablensSessionDoc>(
      `/v1/sablens/sessions/${encodeURIComponent(id)}/start`,
      { method: 'POST', body: '{}' },
    ),
  end: (id: string) =>
    rustFetch<SablensSessionDoc>(
      `/v1/sablens/sessions/${encodeURIComponent(id)}/end`,
      { method: 'POST', body: '{}' },
    ),
  appendSnapshot: (id: string, fileId: string) =>
    rustFetch<SablensSessionDoc>(
      `/v1/sablens/sessions/${encodeURIComponent(id)}/snapshots`,
      { method: 'POST', body: JSON.stringify({ fileId }) },
    ),
  reissueCustomerToken: (id: string) =>
    rustFetch<{ customerJoinToken: string }>(
      `/v1/sablens/sessions/${encodeURIComponent(id)}/customer-token`,
      { method: 'POST', body: '{}' },
    ),
  // Public (no JWT) — guarded by token alone.
  publicView: (token: string) =>
    rustFetch<SablensPublicSessionView>(
      `/v1/sablens/sessions-public/${encodeURIComponent(token)}`,
    ),
  publicJoin: (token: string) =>
    rustFetch<SablensPublicSessionView>(
      `/v1/sablens/sessions-public/${encodeURIComponent(token)}/join`,
      { method: 'POST', body: '{}' },
    ),
};
