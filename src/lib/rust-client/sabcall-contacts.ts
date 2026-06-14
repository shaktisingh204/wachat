import 'server-only';

/**
 * SabCall Contacts client — wraps `/v1/sabcall/contacts`.
 */
import { rustFetch } from './fetcher';

export type VoiceContactStatus = 'active' | 'archived';

export interface VoiceContactDoc {
  _id: string;
  userId?: string;
  name: string;
  phone: string;
  email?: string;
  company?: string;
  tags?: string[];
  vip?: boolean;
  notes?: string;
  status: VoiceContactStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface VoiceContactListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: VoiceContactStatus | 'all';
  vip?: boolean;
  tag?: string;
}

export interface VoiceContactListResponse {
  items: VoiceContactDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface VoiceContactCreateInput {
  name: string;
  phone: string;
  email?: string;
  company?: string;
  tags?: string[];
  vip?: boolean;
  notes?: string;
  status?: VoiceContactStatus;
}

export type VoiceContactUpdateInput = Partial<
  Pick<
    VoiceContactCreateInput,
    'name' | 'phone' | 'email' | 'company' | 'tags' | 'vip' | 'notes' | 'status'
  >
>;

function buildListQuery(p?: VoiceContactListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.vip != null) qs.set('vip', String(p.vip));
  if (p.tag) qs.set('tag', p.tag);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const sabcallContactsApi = {
  list: (params?: VoiceContactListParams) =>
    rustFetch<VoiceContactListResponse>(
      `/v1/sabcall/contacts${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<VoiceContactDoc>(`/v1/sabcall/contacts/${encodeURIComponent(id)}`),
  create: (input: VoiceContactCreateInput) =>
    rustFetch<{ id: string; entity: VoiceContactDoc }>('/v1/sabcall/contacts', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: VoiceContactUpdateInput) =>
    rustFetch<VoiceContactDoc>(`/v1/sabcall/contacts/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/sabcall/contacts/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
      },
    ),
};
