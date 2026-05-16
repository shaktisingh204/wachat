import 'server-only';

/**
 * CRM Account Group client — wraps `/v1/crm/account-groups` on the Rust BFF.
 *
 * Mirrors the Rust `CrmAccountGroup` DTO in
 * `rust/crates/crm-account-groups/src/types.rs`. Counterpart to the direct-Mongo
 * server actions in `src/app/actions/crm-accounting.actions.ts`; when
 * `USE_RUST_CRM === 'true'` the per-id getter delegates here.
 */
import { rustFetch } from './fetcher';

export type CrmAccountGroupStatus = 'active' | 'archived';

/** Accounting nature of the group — drives report classification. */
export type CrmAccountGroupNature =
  | 'asset'
  | 'liability'
  | 'income'
  | 'expense'
  | 'equity';

export interface CrmAccountGroupDoc {
  _id: string;
  userId?: string;
  name: string;
  code?: string;
  nature?: CrmAccountGroupNature;
  parentGroupId?: string;
  isActive: boolean;
  status: CrmAccountGroupStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmAccountGroupListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmAccountGroupStatus | 'all';
  nature?: CrmAccountGroupNature;
  /** Pass `'none'` to fetch top-level groups only. */
  parentGroupId?: string | 'none';
}

export interface CrmAccountGroupListResponse {
  items: CrmAccountGroupDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmAccountGroupCreateInput {
  name: string;
  code?: string;
  nature?: CrmAccountGroupNature;
  parentGroupId?: string;
  isActive?: boolean;
}

export type CrmAccountGroupUpdateInput = Partial<CrmAccountGroupCreateInput> & {
  status?: CrmAccountGroupStatus;
};

function buildListQuery(p?: CrmAccountGroupListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.nature) qs.set('nature', p.nature);
  if (p.parentGroupId) qs.set('parentGroupId', p.parentGroupId);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmAccountGroupsApi = {
  list: (params?: CrmAccountGroupListParams) =>
    rustFetch<CrmAccountGroupListResponse>(
      `/v1/crm/account-groups${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmAccountGroupDoc>(
      `/v1/crm/account-groups/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmAccountGroupCreateInput) =>
    rustFetch<{ id: string; entity: CrmAccountGroupDoc }>(
      '/v1/crm/account-groups',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: CrmAccountGroupUpdateInput) =>
    rustFetch<CrmAccountGroupDoc>(
      `/v1/crm/account-groups/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/account-groups/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
