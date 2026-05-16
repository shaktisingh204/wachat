import 'server-only';

/**
 * CRM Reconciliation client — wraps `/v1/crm/reconciliations`.
 *
 * Each document represents a bank-reconciliation pass over an account for a
 * `[periodStart, periodEnd]` window with opening/closing balances and
 * matched/unmatched counts.
 */
import { rustFetch } from './fetcher';

export type CrmReconciliationStatus = 'in_progress' | 'completed' | 'archived';

export interface CrmReconciliationDoc {
  _id: string;
  userId?: string;
  accountId: string;
  periodStart: string;
  periodEnd: string;
  openingBalance: number;
  closingBalance: number;
  matchedCount: number;
  unmatchedCount: number;
  notes?: string;
  status: CrmReconciliationStatus;
  finalizedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmReconciliationListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmReconciliationStatus | 'all';
  accountId?: string;
}

export interface CrmReconciliationListResponse {
  items: CrmReconciliationDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmReconciliationCreateInput {
  accountId: string;
  periodStart: string;
  periodEnd: string;
  openingBalance?: number;
  closingBalance?: number;
  matchedCount?: number;
  unmatchedCount?: number;
  notes?: string;
  status?: CrmReconciliationStatus;
}

export type CrmReconciliationUpdateInput = Partial<CrmReconciliationCreateInput> & {
  finalizedAt?: string;
};

function buildListQuery(p?: CrmReconciliationListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.accountId) qs.set('accountId', p.accountId);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmReconciliationApi = {
  list: (params?: CrmReconciliationListParams) =>
    rustFetch<CrmReconciliationListResponse>(
      `/v1/crm/reconciliations${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmReconciliationDoc>(
      `/v1/crm/reconciliations/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmReconciliationCreateInput) =>
    rustFetch<{ id: string; entity: CrmReconciliationDoc }>(
      '/v1/crm/reconciliations',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: CrmReconciliationUpdateInput) =>
    rustFetch<CrmReconciliationDoc>(
      `/v1/crm/reconciliations/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/reconciliations/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
