import 'server-only';

/**
 * SabCall SIP credentials client — wraps `/v1/sabcall/credentials`.
 */
import { rustFetch } from './fetcher';

export type SipCredentialStatus = 'active' | 'disabled';

export interface SipCredentialDoc {
  _id: string;
  userId?: string;
  username: string;
  passwordRef?: string;
  domainId?: string;
  label?: string;
  agentUserId?: string;
  codecs?: string[];
  status: SipCredentialStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface SipCredentialListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: SipCredentialStatus | 'all';
}

export interface SipCredentialListResponse {
  items: SipCredentialDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface SipCredentialCreateInput {
  username: string;
  passwordRef?: string;
  domainId?: string;
  label?: string;
  agentUserId?: string;
  codecs?: string[];
  status?: SipCredentialStatus;
}

export type SipCredentialUpdateInput = Partial<
  Pick<
    SipCredentialCreateInput,
    | 'passwordRef'
    | 'domainId'
    | 'label'
    | 'agentUserId'
    | 'codecs'
    | 'status'
  >
>;

function buildListQuery(p?: SipCredentialListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const sabcallCredentialsApi = {
  list: (params?: SipCredentialListParams) =>
    rustFetch<SipCredentialListResponse>(
      `/v1/sabcall/credentials${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<SipCredentialDoc>(
      `/v1/sabcall/credentials/${encodeURIComponent(id)}`,
    ),
  create: (input: SipCredentialCreateInput) =>
    rustFetch<{ id: string; entity: SipCredentialDoc }>(
      '/v1/sabcall/credentials',
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
    ),
  update: (id: string, patch: SipCredentialUpdateInput) =>
    rustFetch<SipCredentialDoc>(
      `/v1/sabcall/credentials/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(patch),
      },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/sabcall/credentials/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
      },
    ),
};
