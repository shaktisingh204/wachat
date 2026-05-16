import 'server-only';

/**
 * CRM Ticket Channels client — wraps `/v1/crm/ticket-channels`.
 */
import { rustFetch } from './fetcher';

export type CrmTicketChannelStatus = 'active' | 'archived';

export type CrmTicketChannelType =
  | 'email'
  | 'web'
  | 'phone'
  | 'whatsapp'
  | 'chat'
  | 'social'
  | 'api';

export interface CrmTicketChannelDoc {
  _id: string;
  userId?: string;
  name: string;
  channelType: CrmTicketChannelType | string;
  inboxEmail?: string;
  webhookUrl?: string;
  assignedAgentGroup?: string;
  defaultPriority?: string;
  defaultSlaId?: string;
  autoAssign: boolean;
  isActive: boolean;
  status: CrmTicketChannelStatus;
  settings?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmTicketChannelListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmTicketChannelStatus | 'all';
  channelType?: CrmTicketChannelType | string;
  isActive?: boolean;
}

export interface CrmTicketChannelListResponse {
  items: CrmTicketChannelDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmTicketChannelCreateInput {
  name: string;
  channelType: CrmTicketChannelType | string;
  inboxEmail?: string;
  webhookUrl?: string;
  assignedAgentGroup?: string;
  defaultPriority?: string;
  defaultSlaId?: string;
  autoAssign?: boolean;
  isActive?: boolean;
  settings?: Record<string, unknown>;
}

export type CrmTicketChannelUpdateInput = Partial<CrmTicketChannelCreateInput> & {
  status?: CrmTicketChannelStatus;
};

function buildListQuery(p?: CrmTicketChannelListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.channelType) qs.set('channelType', p.channelType);
  if (p.isActive != null) qs.set('isActive', String(p.isActive));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmTicketChannelsApi = {
  list: (params?: CrmTicketChannelListParams) =>
    rustFetch<CrmTicketChannelListResponse>(
      `/v1/crm/ticket-channels${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmTicketChannelDoc>(
      `/v1/crm/ticket-channels/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmTicketChannelCreateInput) =>
    rustFetch<{ id: string; entity: CrmTicketChannelDoc }>(
      '/v1/crm/ticket-channels',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: CrmTicketChannelUpdateInput) =>
    rustFetch<CrmTicketChannelDoc>(
      `/v1/crm/ticket-channels/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/ticket-channels/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
