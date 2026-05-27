import 'server-only';

/**
 * SabAssist Sessions client — wraps `/v1/sabassist/sessions`.
 *
 * A SabAssist session models a remote-screen-share between a technician
 * (the calling tenant) and a customer. Optionally linked to a SabVoice
 * call via {@link SabassistSessionDoc.callId}.
 */
import { rustFetch } from './fetcher';

export type SabassistSessionStatus = 'scheduled' | 'active' | 'ended';
export type SabassistSessionMode = 'attended' | 'unattended';

export interface SabassistSessionDoc {
  _id: string;
  userId?: string;
  technicianUserId: string;
  customerName?: string;
  customerEmail?: string;
  /** Linked SabVoice call id, if any. */
  callId?: string;
  status: SabassistSessionStatus;
  mode: SabassistSessionMode;
  startedAt?: string;
  endedAt?: string;
  durationSecs?: number;
  /** SabFile id for the recording. */
  recordingFileId?: string;
  /** Pointer to a registered unattended device. */
  deviceId?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SabassistSessionListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: SabassistSessionStatus | 'all';
  mode?: SabassistSessionMode;
  callId?: string;
  deviceId?: string;
  from?: string;
  to?: string;
}

export interface SabassistSessionListResponse {
  items: SabassistSessionDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface SabassistSessionCreateInput {
  technicianUserId?: string;
  customerName?: string;
  customerEmail?: string;
  callId?: string;
  mode: SabassistSessionMode;
  deviceId?: string;
  status?: SabassistSessionStatus;
  notes?: string;
}

export interface SabassistSessionUpdateInput {
  status?: SabassistSessionStatus;
  startedAt?: string;
  endedAt?: string;
  durationSecs?: number;
  recordingFileId?: string;
  notes?: string;
  customerName?: string;
  customerEmail?: string;
}

function buildListQuery(p?: SabassistSessionListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.mode) qs.set('mode', p.mode);
  if (p.callId) qs.set('callId', p.callId);
  if (p.deviceId) qs.set('deviceId', p.deviceId);
  if (p.from) qs.set('from', p.from);
  if (p.to) qs.set('to', p.to);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const sabassistSessionsApi = {
  list: (params?: SabassistSessionListParams) =>
    rustFetch<SabassistSessionListResponse>(
      `/v1/sabassist/sessions${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<SabassistSessionDoc>(
      `/v1/sabassist/sessions/${encodeURIComponent(id)}`,
    ),
  create: (input: SabassistSessionCreateInput) =>
    rustFetch<{ id: string; entity: SabassistSessionDoc }>(
      '/v1/sabassist/sessions',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: SabassistSessionUpdateInput) =>
    rustFetch<SabassistSessionDoc>(
      `/v1/sabassist/sessions/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/sabassist/sessions/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
