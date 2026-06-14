import 'server-only';

/**
 * SabCall SIP ACLs client — wraps `/v1/sabcall/acls`.
 *
 * Mirrors {@link ./sabcall-dids}. An ACL is an IP access-control rule
 * (allow/deny over a set of CIDRs) applied to SIP trunk and/or registration
 * traffic. Every doc is scoped to the active SabCall project (the workspace
 * id sent as the Rust JWT `tid` claim — see `runWithRustTenant`).
 */
import { rustFetch } from './fetcher';

export type SipAclAction = 'allow' | 'deny';
export type SipAclAppliesTo = 'trunk' | 'registration' | 'all';
export type SipAclStatus = 'active' | 'disabled';

export interface SipAclDoc {
  _id: string;
  userId?: string;
  name: string;
  action: SipAclAction;
  cidrs: string[];
  appliesTo: SipAclAppliesTo;
  status: SipAclStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface SipAclListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: SipAclStatus | 'all';
}

export interface SipAclListResponse {
  items: SipAclDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface SipAclCreateInput {
  name: string;
  action?: SipAclAction;
  cidrs: string[];
  appliesTo?: SipAclAppliesTo;
  status?: SipAclStatus;
}

export type SipAclUpdateInput = Partial<
  Pick<SipAclCreateInput, 'name' | 'action' | 'cidrs' | 'appliesTo' | 'status'>
>;

function buildListQuery(p?: SipAclListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const sabcallAclsApi = {
  list: (params?: SipAclListParams) =>
    rustFetch<SipAclListResponse>(`/v1/sabcall/acls${buildListQuery(params)}`),
  getById: (id: string) =>
    rustFetch<SipAclDoc>(`/v1/sabcall/acls/${encodeURIComponent(id)}`),
  create: (input: SipAclCreateInput) =>
    rustFetch<{ id: string; entity: SipAclDoc }>('/v1/sabcall/acls', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: SipAclUpdateInput) =>
    rustFetch<SipAclDoc>(`/v1/sabcall/acls/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(`/v1/sabcall/acls/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
};
