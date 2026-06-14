import 'server-only';

/**
 * SabCall agent presence client — wraps `/v1/sabcall/agents-presence`.
 */
import { rustFetch } from './fetcher';

export type AgentPresenceStatus = 'available' | 'busy' | 'away' | 'offline';

export interface AgentPresenceDoc {
  _id?: string;
  userId?: string;
  agentUserId: string;
  status: AgentPresenceStatus;
  activeCallId?: string;
  queueIds?: string[];
  displayName?: string;
  lastChangeAt: string;
}

export interface AgentPresenceListParams {
  status?: AgentPresenceStatus;
  queueId?: string;
}

export interface AgentPresenceUpsertInput {
  agentUserId: string;
  status: AgentPresenceStatus;
  activeCallId?: string;
  queueIds?: string[];
  displayName?: string;
}

function buildListQuery(p?: AgentPresenceListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.status) qs.set('status', p.status);
  if (p.queueId) qs.set('queueId', p.queueId);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const sabcallAgentsPresenceApi = {
  list: (params?: AgentPresenceListParams) =>
    rustFetch<{ items: AgentPresenceDoc[] }>(
      `/v1/sabcall/agents-presence${buildListQuery(params)}`,
    ),
  getByAgentId: (agentId: string) =>
    rustFetch<AgentPresenceDoc>(
      `/v1/sabcall/agents-presence/${encodeURIComponent(agentId)}`,
    ),
  upsert: (input: AgentPresenceUpsertInput) =>
    rustFetch<{ entity: AgentPresenceDoc }>('/v1/sabcall/agents-presence', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
};
