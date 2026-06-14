import 'server-only';

/**
 * SabCall IVRs client — wraps `/v1/sabcall/ivrs`.
 */
import { rustFetch } from './fetcher';

export type VoiceIvrStatus = 'draft' | 'active' | 'archived';
export type VoiceIvrNodeType =
  | 'menu'
  | 'playback'
  | 'forward'
  | 'voicemail'
  | 'hangup'
  | 'conditional';

export interface VoiceIvrNode {
  type: VoiceIvrNodeType;
  /** Free-form per-node props — e.g. `key`, `prompt`, `to`, `condition`, etc. */
  [key: string]: unknown;
  children?: VoiceIvrNode[];
}

export interface VoiceIvrDoc {
  _id: string;
  userId?: string;
  name: string;
  description?: string;
  status: VoiceIvrStatus;
  rootNode: VoiceIvrNode;
  greetingFileId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface VoiceIvrListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: VoiceIvrStatus | 'all';
}

export interface VoiceIvrListResponse {
  items: VoiceIvrDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface VoiceIvrCreateInput {
  name: string;
  description?: string;
  status?: VoiceIvrStatus;
  rootNode?: VoiceIvrNode;
  greetingFileId?: string;
}

export type VoiceIvrUpdateInput = Partial<VoiceIvrCreateInput>;

function buildListQuery(p?: VoiceIvrListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const sabcallIvrsApi = {
  list: (params?: VoiceIvrListParams) =>
    rustFetch<VoiceIvrListResponse>(`/v1/sabcall/ivrs${buildListQuery(params)}`),
  getById: (id: string) =>
    rustFetch<VoiceIvrDoc>(`/v1/sabcall/ivrs/${encodeURIComponent(id)}`),
  create: (input: VoiceIvrCreateInput) =>
    rustFetch<{ id: string; entity: VoiceIvrDoc }>('/v1/sabcall/ivrs', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: VoiceIvrUpdateInput) =>
    rustFetch<VoiceIvrDoc>(`/v1/sabcall/ivrs/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(`/v1/sabcall/ivrs/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
};
