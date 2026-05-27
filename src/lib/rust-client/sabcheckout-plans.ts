import 'server-only';

/**
 * SabCheckout Plans client — wraps `/v1/sabcheckout/plans`.
 *
 * Counterpart of the Rust crate `sabcheckout-plans`. CRUD over
 * recurring billing templates.
 */
import { rustFetch } from './fetcher';

export type SabcheckoutPlanIntervalUnit = 'day' | 'week' | 'month' | 'year';
export type SabcheckoutPlanStatus = 'draft' | 'active' | 'archived';

export interface SabcheckoutPlanDoc {
  _id: string;
  userId: string;
  name: string;
  intervalUnit: SabcheckoutPlanIntervalUnit;
  intervalCount: number;
  amountMinor: number;
  currency: string;
  trialDays?: number;
  setupFeeMinor?: number;
  description?: string;
  status: SabcheckoutPlanStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface SabcheckoutPlanListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: SabcheckoutPlanStatus | 'all';
}

export interface SabcheckoutPlanListResponse {
  items: SabcheckoutPlanDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface SabcheckoutPlanCreateInput {
  name: string;
  intervalUnit: SabcheckoutPlanIntervalUnit;
  intervalCount?: number;
  amountMinor: number;
  currency?: string;
  trialDays?: number;
  setupFeeMinor?: number;
  description?: string;
  status?: SabcheckoutPlanStatus;
}

export type SabcheckoutPlanUpdateInput = Partial<SabcheckoutPlanCreateInput>;

function buildListQuery(p?: SabcheckoutPlanListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const sabcheckoutPlansApi = {
  list: (params?: SabcheckoutPlanListParams) =>
    rustFetch<SabcheckoutPlanListResponse>(
      `/v1/sabcheckout/plans${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<SabcheckoutPlanDoc>(
      `/v1/sabcheckout/plans/${encodeURIComponent(id)}`,
    ),
  create: (input: SabcheckoutPlanCreateInput) =>
    rustFetch<{ id: string; entity: SabcheckoutPlanDoc }>(
      '/v1/sabcheckout/plans',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: SabcheckoutPlanUpdateInput) =>
    rustFetch<SabcheckoutPlanDoc>(
      `/v1/sabcheckout/plans/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/sabcheckout/plans/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
