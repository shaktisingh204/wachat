import 'server-only';

/**
 * SabCall Queues client — wraps `/v1/sabcall/queues`.
 */
import { rustFetch } from './fetcher';

export type VoiceQueueStrategy = 'round_robin' | 'least_busy' | 'simultaneous';
export type VoiceQueueStatus = 'active' | 'archived';

export interface VoiceQueueDoc {
  _id: string;
  userId?: string;
  name: string;
  description?: string;
  strategy: VoiceQueueStrategy;
  agentIds: string[];
  maxWaitSecs: number;
  fallback?: string;
  holdMusicFileId?: string;
  status: VoiceQueueStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface VoiceQueueListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: VoiceQueueStatus | 'all';
}

export interface VoiceQueueListResponse {
  items: VoiceQueueDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface VoiceQueueCreateInput {
  name: string;
  description?: string;
  strategy?: VoiceQueueStrategy;
  agentIds?: string[];
  maxWaitSecs?: number;
  fallback?: string;
  holdMusicFileId?: string;
  status?: VoiceQueueStatus;
}

export type VoiceQueueUpdateInput = Partial<VoiceQueueCreateInput>;

function buildListQuery(p?: VoiceQueueListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const sabcallQueuesApi = {
  list: (params?: VoiceQueueListParams) =>
    rustFetch<VoiceQueueListResponse>(`/v1/sabcall/queues${buildListQuery(params)}`),
  getById: (id: string) =>
    rustFetch<VoiceQueueDoc>(`/v1/sabcall/queues/${encodeURIComponent(id)}`),
  create: (input: VoiceQueueCreateInput) =>
    rustFetch<{ id: string; entity: VoiceQueueDoc }>('/v1/sabcall/queues', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: VoiceQueueUpdateInput) =>
    rustFetch<VoiceQueueDoc>(`/v1/sabcall/queues/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(`/v1/sabcall/queues/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
};
