import 'server-only';

import { rustFetch } from './fetcher';

export interface SablensChatMessageDoc {
  _id: string;
  userId?: string;
  sessionId: string;
  ts: string;
  senderUserId?: string;
  senderKind: 'user' | 'guest';
  body: string;
  attachmentIds?: string[];
  createdAt?: string;
}

export interface SablensChatListParams {
  sessionId?: string;
  page?: number;
  limit?: number;
}

export interface SablensChatListResponse {
  items: SablensChatMessageDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface SablensChatSendInput {
  sessionId: string;
  body: string;
  senderKind?: 'user' | 'guest';
  attachmentIds?: string[];
}

function buildListQuery(p?: SablensChatListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.sessionId) qs.set('sessionId', p.sessionId);
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const sablensChatApi = {
  list: (params?: SablensChatListParams) =>
    rustFetch<SablensChatListResponse>(
      `/v1/sablens/chat${buildListQuery(params)}`,
    ),
  send: (input: SablensChatSendInput) =>
    rustFetch<{ id: string; entity: SablensChatMessageDoc }>(
      '/v1/sablens/chat',
      { method: 'POST', body: JSON.stringify(input) },
    ),
};
