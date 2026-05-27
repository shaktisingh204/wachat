import 'server-only';

/**
 * SabCheckout subscriptions client — wraps
 * `/v1/sabcheckout/subscriptions`. Counterpart of
 * `sabcheckout-subscriptions`.
 */
import { rustFetch } from './fetcher';

export type SabcheckoutSubscriptionStatus =
  | 'active'
  | 'past_due'
  | 'paused'
  | 'cancelled';

export interface SabcheckoutSubscriptionDoc {
  _id: string;
  userId: string;
  planId: string;
  customerId: string;
  status: SabcheckoutSubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  providerSubscriptionId?: string;
  cancelledAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SabcheckoutSubscriptionListParams {
  page?: number;
  limit?: number;
  status?: SabcheckoutSubscriptionStatus | 'all';
  planId?: string;
  customerId?: string;
}

export interface SabcheckoutSubscriptionListResponse {
  items: SabcheckoutSubscriptionDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface SabcheckoutSubscriptionCreateInput {
  planId: string;
  customerId: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  status?: SabcheckoutSubscriptionStatus;
  providerSubscriptionId?: string;
}

export type SabcheckoutSubscriptionUpdateInput =
  Partial<SabcheckoutSubscriptionCreateInput>;

function buildListQuery(p?: SabcheckoutSubscriptionListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.status) qs.set('status', p.status);
  if (p.planId) qs.set('planId', p.planId);
  if (p.customerId) qs.set('customerId', p.customerId);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const sabcheckoutSubscriptionsApi = {
  list: (params?: SabcheckoutSubscriptionListParams) =>
    rustFetch<SabcheckoutSubscriptionListResponse>(
      `/v1/sabcheckout/subscriptions${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<SabcheckoutSubscriptionDoc>(
      `/v1/sabcheckout/subscriptions/${encodeURIComponent(id)}`,
    ),
  create: (input: SabcheckoutSubscriptionCreateInput) =>
    rustFetch<{ id: string; entity: SabcheckoutSubscriptionDoc }>(
      '/v1/sabcheckout/subscriptions',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: SabcheckoutSubscriptionUpdateInput) =>
    rustFetch<SabcheckoutSubscriptionDoc>(
      `/v1/sabcheckout/subscriptions/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  cancel: (id: string) =>
    rustFetch<{ cancelled: boolean; entity: SabcheckoutSubscriptionDoc }>(
      `/v1/sabcheckout/subscriptions/${encodeURIComponent(id)}/cancel`,
      { method: 'POST' },
    ),
};
