import 'server-only';

/**
 * CRM Chart of Accounts client — wraps `/v1/crm/chart-of-accounts`.
 *
 * Backs the legacy `crm_chart_of_accounts` Mongo collection through the
 * Rust BFF. The Next.js side falls back to a direct Mongo read whenever
 * this client throws; see `getChartOfAccountById` in
 * `@/app/actions/crm-accounting.actions.ts`.
 */
import { rustFetch } from './fetcher';

export type CrmChartOfAccountStatus = 'active' | 'archived';

export type CrmChartOfAccountType =
  | 'asset'
  | 'liability'
  | 'income'
  | 'expense'
  | 'equity';

export interface CrmChartOfAccountDoc {
  _id: string;
  userId?: string;
  name: string;
  code?: string;
  accountGroupId?: string;
  accountType?: CrmChartOfAccountType;
  parentId?: string;
  openingBalance?: number;
  currency?: string;
  isActive: boolean;
  status: CrmChartOfAccountStatus;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmChartOfAccountListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmChartOfAccountStatus | 'active_visible' | 'all';
  accountType?: CrmChartOfAccountType;
  accountGroupId?: string;
}

export interface CrmChartOfAccountListResponse {
  items: CrmChartOfAccountDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmChartOfAccountCreateInput {
  name: string;
  code?: string;
  accountGroupId?: string;
  accountType?: CrmChartOfAccountType;
  parentId?: string;
  openingBalance?: number;
  currency?: string;
  isActive?: boolean;
  notes?: string;
}

export type CrmChartOfAccountUpdateInput =
  Partial<CrmChartOfAccountCreateInput> & {
    status?: CrmChartOfAccountStatus;
  };

function buildListQuery(p?: CrmChartOfAccountListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.accountType) qs.set('accountType', p.accountType);
  if (p.accountGroupId) qs.set('accountGroupId', p.accountGroupId);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmChartOfAccountsApi = {
  list: (params?: CrmChartOfAccountListParams) =>
    rustFetch<CrmChartOfAccountListResponse>(
      `/v1/crm/chart-of-accounts${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmChartOfAccountDoc>(
      `/v1/crm/chart-of-accounts/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmChartOfAccountCreateInput) =>
    rustFetch<{ id: string; entity: CrmChartOfAccountDoc }>(
      '/v1/crm/chart-of-accounts',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: CrmChartOfAccountUpdateInput) =>
    rustFetch<CrmChartOfAccountDoc>(
      `/v1/crm/chart-of-accounts/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/chart-of-accounts/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
