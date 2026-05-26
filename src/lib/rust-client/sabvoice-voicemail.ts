import 'server-only';

/**
 * SabVoice Voicemail client — wraps `/v1/sabvoice/voicemail`.
 */
import { rustFetch } from './fetcher';

export type VoicemailStatus = 'new' | 'listened' | 'archived';

export interface VoicemailDoc {
  _id: string;
  userId?: string;
  callId: string;
  fromNumber: string;
  toNumber?: string;
  audioFileId: string;
  durationSecs?: number;
  transcript?: string;
  listenedBy: string[];
  status: VoicemailStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface VoicemailListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: VoicemailStatus | 'all';
}

export interface VoicemailListResponse {
  items: VoicemailDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface VoicemailCreateInput {
  callId: string;
  fromNumber: string;
  toNumber?: string;
  audioFileId: string;
  durationSecs?: number;
  transcript?: string;
}

export interface VoicemailUpdateInput {
  transcript?: string;
  status?: VoicemailStatus;
}

function buildListQuery(p?: VoicemailListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const sabvoiceVoicemailApi = {
  list: (params?: VoicemailListParams) =>
    rustFetch<VoicemailListResponse>(`/v1/sabvoice/voicemail${buildListQuery(params)}`),
  getById: (id: string) =>
    rustFetch<VoicemailDoc>(`/v1/sabvoice/voicemail/${encodeURIComponent(id)}`),
  create: (input: VoicemailCreateInput) =>
    rustFetch<{ id: string; entity: VoicemailDoc }>('/v1/sabvoice/voicemail', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: VoicemailUpdateInput) =>
    rustFetch<VoicemailDoc>(`/v1/sabvoice/voicemail/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/sabvoice/voicemail/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
  listen: (id: string, listenerId: string) =>
    rustFetch<VoicemailDoc>(
      `/v1/sabvoice/voicemail/${encodeURIComponent(id)}/listen`,
      { method: 'POST', body: JSON.stringify({ listenerId }) },
    ),
};
