import 'server-only';

/**
 * SabCall SIP domains client — wraps `/v1/sabcall/domains`.
 *
 * Mirrors the on-disk shape of the `sabcall-domains` Rust crate
 * (`SipDomain` / `CreateDomainInput` / `UpdateDomainInput`). Field names are
 * camelCase to match the crate's `#[serde(rename_all = "camelCase")]`.
 */
import { rustFetch } from './fetcher';

export type SipDomainStatus = 'active' | 'disabled';

export interface SipDomainDoc {
  _id: string;
  userId?: string;
  domain: string;
  label?: string;
  recordCalls: boolean;
  defaultApplicationId?: string;
  status: SipDomainStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface SipDomainListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: SipDomainStatus | 'all';
}

export interface SipDomainListResponse {
  items: SipDomainDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface SipDomainCreateInput {
  domain: string;
  label?: string;
  recordCalls?: boolean;
  defaultApplicationId?: string;
  status?: SipDomainStatus;
}

export type SipDomainUpdateInput = Partial<
  Pick<
    SipDomainCreateInput,
    'label' | 'recordCalls' | 'defaultApplicationId' | 'status'
  >
>;

function buildListQuery(p?: SipDomainListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const sabcallDomainsApi = {
  list: (params?: SipDomainListParams) =>
    rustFetch<SipDomainListResponse>(`/v1/sabcall/domains${buildListQuery(params)}`),
  getById: (id: string) =>
    rustFetch<SipDomainDoc>(`/v1/sabcall/domains/${encodeURIComponent(id)}`),
  create: (input: SipDomainCreateInput) =>
    rustFetch<{ id: string; entity: SipDomainDoc }>('/v1/sabcall/domains', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: SipDomainUpdateInput) =>
    rustFetch<SipDomainDoc>(`/v1/sabcall/domains/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(`/v1/sabcall/domains/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
};
