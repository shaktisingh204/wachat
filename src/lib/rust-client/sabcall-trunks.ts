import 'server-only';

/**
 * SabCall SIP trunks client — wraps `/v1/sabcall/trunks`.
 */
import { rustFetch } from './fetcher';

export type SipTrunkStatus = 'active' | 'disabled';
export type SipTransport = 'udp' | 'tcp' | 'tls';

export interface SipTrunkDoc {
  _id: string;
  userId?: string;
  name: string;
  provider: string;
  sipServer: string;
  port?: number;
  transport: string;
  authUsername?: string;
  authPasswordRef?: string;
  fromDomain?: string;
  fromUser?: string;
  register: boolean;
  inboundEnabled: boolean;
  outboundEnabled: boolean;
  codecs?: string[];
  maxChannels?: number;
  status: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SipTrunkListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: SipTrunkStatus | 'all';
  provider?: string;
}

export interface SipTrunkListResponse {
  items: SipTrunkDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface SipTrunkCreateInput {
  name: string;
  sipServer: string;
  provider?: string;
  port?: number;
  transport?: string;
  authUsername?: string;
  authPasswordRef?: string;
  fromDomain?: string;
  fromUser?: string;
  register?: boolean;
  inboundEnabled?: boolean;
  outboundEnabled?: boolean;
  codecs?: string[];
  maxChannels?: number;
  status?: string;
  notes?: string;
}

export type SipTrunkUpdateInput = Partial<
  Pick<
    SipTrunkCreateInput,
    | 'name'
    | 'provider'
    | 'sipServer'
    | 'port'
    | 'transport'
    | 'authUsername'
    | 'authPasswordRef'
    | 'fromDomain'
    | 'fromUser'
    | 'register'
    | 'inboundEnabled'
    | 'outboundEnabled'
    | 'codecs'
    | 'maxChannels'
    | 'status'
    | 'notes'
  >
>;

function buildListQuery(p?: SipTrunkListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.provider) qs.set('provider', p.provider);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const sabcallTrunksApi = {
  list: (params?: SipTrunkListParams) =>
    rustFetch<SipTrunkListResponse>(`/v1/sabcall/trunks${buildListQuery(params)}`),
  getById: (id: string) =>
    rustFetch<SipTrunkDoc>(`/v1/sabcall/trunks/${encodeURIComponent(id)}`),
  create: (input: SipTrunkCreateInput) =>
    rustFetch<{ id: string; entity: SipTrunkDoc }>('/v1/sabcall/trunks', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: SipTrunkUpdateInput) =>
    rustFetch<SipTrunkDoc>(`/v1/sabcall/trunks/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(`/v1/sabcall/trunks/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
};
