import 'server-only';

/**
 * SabCall DIDs client — wraps `/v1/sabcall/dids`.
 */
import { rustFetch } from './fetcher';

export type VoiceDidStatus = 'active' | 'pending' | 'released';
export type VoiceProvider = 'twilio' | 'plivo' | 'mock';
export type VoiceCapability = 'voice' | 'sms' | 'mms';

export interface VoiceDidDoc {
  _id: string;
  userId?: string;
  number: string;
  country: string;
  capabilities?: VoiceCapability[] | string[];
  status: VoiceDidStatus;
  label?: string;
  provider: VoiceProvider;
  providerRef?: string;
  monthlyCost?: number;
  currency?: string;
  routeToIvrId?: string;
  routeToQueueId?: string;
  routeToUserId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface VoiceDidListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: VoiceDidStatus | 'all';
  country?: string;
  provider?: VoiceProvider;
}

export interface VoiceDidListResponse {
  items: VoiceDidDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface VoiceDidCreateInput {
  number: string;
  country: string;
  provider: VoiceProvider;
  capabilities?: VoiceCapability[];
  status?: VoiceDidStatus;
  label?: string;
  providerRef?: string;
  monthlyCost?: number;
  currency?: string;
  routeToIvrId?: string;
  routeToQueueId?: string;
  routeToUserId?: string;
}

export type VoiceDidUpdateInput = Partial<
  Pick<
    VoiceDidCreateInput,
    | 'label'
    | 'status'
    | 'capabilities'
    | 'monthlyCost'
    | 'currency'
    | 'routeToIvrId'
    | 'routeToQueueId'
    | 'routeToUserId'
  >
>;

export interface AvailableNumber {
  number: string;
  country: string;
  capabilities: string[];
  monthlyCost: number;
  currency: string;
  provider: VoiceProvider;
}

export interface DidSearchParams {
  country: string;
  areaCode?: string;
  contains?: string;
  limit?: number;
}

function buildListQuery(p?: VoiceDidListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.country) qs.set('country', p.country);
  if (p.provider) qs.set('provider', p.provider);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const sabcallDidsApi = {
  list: (params?: VoiceDidListParams) =>
    rustFetch<VoiceDidListResponse>(`/v1/sabcall/dids${buildListQuery(params)}`),
  getById: (id: string) =>
    rustFetch<VoiceDidDoc>(`/v1/sabcall/dids/${encodeURIComponent(id)}`),
  create: (input: VoiceDidCreateInput) =>
    rustFetch<{ id: string; entity: VoiceDidDoc }>('/v1/sabcall/dids', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: VoiceDidUpdateInput) =>
    rustFetch<VoiceDidDoc>(`/v1/sabcall/dids/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(`/v1/sabcall/dids/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
  search: (params: DidSearchParams) => {
    const qs = new URLSearchParams();
    qs.set('country', params.country);
    if (params.areaCode) qs.set('areaCode', params.areaCode);
    if (params.contains) qs.set('contains', params.contains);
    if (params.limit != null) qs.set('limit', String(params.limit));
    return rustFetch<{ items: AvailableNumber[] }>(
      `/v1/sabcall/dids/search?${qs.toString()}`,
    );
  },
};
