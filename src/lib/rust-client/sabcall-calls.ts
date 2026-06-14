import 'server-only';

/**
 * SabCall Calls (CDR) client — wraps `/v1/sabcall/calls`.
 */
import { rustFetch } from './fetcher';

export type VoiceCallStatus =
  | 'completed'
  | 'missed'
  | 'abandoned'
  | 'voicemail'
  | 'failed';
export type VoiceCallDirection = 'inbound' | 'outbound';
export type VoiceProvider = 'twilio' | 'plivo' | 'mock';

export interface VoiceCallDoc {
  _id: string;
  userId?: string;
  fromNumber: string;
  toNumber: string;
  direction: VoiceCallDirection;
  agentId?: string;
  queueId?: string;
  ivrId?: string;
  didId?: string;
  startedAt: string;
  endedAt?: string;
  durationSecs: number;
  status: VoiceCallStatus;
  recordingFileId?: string;
  provider: VoiceProvider;
  providerCallSid?: string;
  cost?: number;
  currency?: string;
  notes?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface VoiceCallListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: VoiceCallStatus | 'all';
  direction?: VoiceCallDirection;
  agentId?: string;
  queueId?: string;
  from?: string;
  to?: string;
}

export interface VoiceCallListResponse {
  items: VoiceCallDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface VoiceCallCreateInput {
  fromNumber: string;
  toNumber: string;
  direction: VoiceCallDirection;
  agentId?: string;
  queueId?: string;
  ivrId?: string;
  didId?: string;
  startedAt?: string;
  endedAt?: string;
  durationSecs?: number;
  status: VoiceCallStatus;
  recordingFileId?: string;
  provider?: VoiceProvider;
  providerCallSid?: string;
  cost?: number;
  currency?: string;
  notes?: string;
  tags?: string[];
}

export type VoiceCallUpdateInput = Partial<
  Pick<
    VoiceCallCreateInput,
    'status' | 'endedAt' | 'durationSecs' | 'recordingFileId' | 'notes' | 'tags' | 'agentId'
  >
>;

function buildListQuery(p?: VoiceCallListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.direction) qs.set('direction', p.direction);
  if (p.agentId) qs.set('agentId', p.agentId);
  if (p.queueId) qs.set('queueId', p.queueId);
  if (p.from) qs.set('from', p.from);
  if (p.to) qs.set('to', p.to);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const sabcallCallsApi = {
  list: (params?: VoiceCallListParams) =>
    rustFetch<VoiceCallListResponse>(`/v1/sabcall/calls${buildListQuery(params)}`),
  getById: (id: string) =>
    rustFetch<VoiceCallDoc>(`/v1/sabcall/calls/${encodeURIComponent(id)}`),
  create: (input: VoiceCallCreateInput) =>
    rustFetch<{ id: string; entity: VoiceCallDoc }>('/v1/sabcall/calls', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: VoiceCallUpdateInput) =>
    rustFetch<VoiceCallDoc>(`/v1/sabcall/calls/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(`/v1/sabcall/calls/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
};
