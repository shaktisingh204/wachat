import 'server-only';

import { rustFetch } from './fetcher';

export type SablensActionKind =
  | 'join'
  | 'leave'
  | 'annotate'
  | 'snapshot'
  | 'chat'
  | 'elevate'
  | 'file_transfer';

export interface SablensActionLogDoc {
  _id: string;
  userId?: string;
  sessionId: string;
  ts: string;
  actorUserId?: string;
  actorKind: 'user' | 'guest';
  action: SablensActionKind;
  payloadJson?: Record<string, unknown>;
}

export interface SablensActionLogListParams {
  sessionId?: string;
  action?: SablensActionKind;
  page?: number;
  limit?: number;
}

export interface SablensActionLogListResponse {
  items: SablensActionLogDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface SablensActionLogAppendInput {
  sessionId: string;
  action: SablensActionKind;
  actorKind?: 'user' | 'guest';
  payloadJson?: Record<string, unknown>;
}

function buildListQuery(p?: SablensActionLogListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.sessionId) qs.set('sessionId', p.sessionId);
  if (p.action) qs.set('action', p.action);
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const sablensActionsLogApi = {
  list: (params?: SablensActionLogListParams) =>
    rustFetch<SablensActionLogListResponse>(
      `/v1/sablens/actions-log${buildListQuery(params)}`,
    ),
  append: (input: SablensActionLogAppendInput) =>
    rustFetch<{ id: string; entity: SablensActionLogDoc }>(
      '/v1/sablens/actions-log',
      { method: 'POST', body: JSON.stringify(input) },
    ),
};
