import 'server-only';

/**
 * SabAssist Actions Log client — wraps `/v1/sabassist/actions`.
 *
 * Append-only audit trail; there is no update / delete endpoint by design.
 */
import { rustFetch } from './fetcher';

export type SabassistActionKind =
  | 'connect'
  | 'disconnect'
  | 'elevate'
  | 'file_transfer'
  | 'annotation'
  | 'reboot_request';

export interface SabassistActionLogDoc {
  _id: string;
  userId?: string;
  sessionId: string;
  ts: string;
  actorUserId: string;
  action: SabassistActionKind;
  payloadJson?: unknown;
}

export interface SabassistActionLogListParams {
  sessionId: string;
  action?: SabassistActionKind;
  limit?: number;
  from?: string;
  to?: string;
}

export interface SabassistActionLogCreateInput {
  sessionId: string;
  action: SabassistActionKind;
  actorUserId?: string;
  ts?: string;
  payloadJson?: unknown;
}

function buildListQuery(p: SabassistActionLogListParams): string {
  const qs = new URLSearchParams();
  qs.set('sessionId', p.sessionId);
  if (p.action) qs.set('action', p.action);
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.from) qs.set('from', p.from);
  if (p.to) qs.set('to', p.to);
  return `?${qs.toString()}`;
}

export const sabassistActionsLogApi = {
  list: (params: SabassistActionLogListParams) =>
    rustFetch<{ items: SabassistActionLogDoc[] }>(
      `/v1/sabassist/actions${buildListQuery(params)}`,
    ),
  create: (input: SabassistActionLogCreateInput) =>
    rustFetch<{ id: string; entity: SabassistActionLogDoc }>(
      '/v1/sabassist/actions',
      { method: 'POST', body: JSON.stringify(input) },
    ),
};
