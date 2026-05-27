import 'server-only';

/**
 * SabCheckout Sessions client — wraps `/v1/sabcheckout/sessions`.
 *
 * Counterpart of the Rust crate `sabcheckout-sessions`. Admin endpoints
 * (list/get) are authenticated; the `public*` helpers hit the
 * unauthenticated `/public/*` sub-routes used by `/pay/[pageSlug]`.
 */
import { rustFetch } from './fetcher';

export type SabcheckoutSessionStatus =
  | 'pending'
  | 'completed'
  | 'failed'
  | 'expired';

export interface SabcheckoutSelectedItem {
  itemIndex: number;
  type: 'amount' | 'plan';
  label: string;
  unitAmountMinor: number;
  quantity: number;
  lineTotalMinor: number;
  planId?: string;
}

export interface SabcheckoutSessionTotals {
  subtotalMinor: number;
  totalMinor: number;
  currency: string;
}

export interface SabcheckoutSessionDoc {
  _id: string;
  userId: string;
  pageId: string;
  payerEmail?: string;
  payerName?: string;
  payerPhone?: string;
  customFieldsJson?: Record<string, unknown>;
  selectedItems?: SabcheckoutSelectedItem[];
  totals: SabcheckoutSessionTotals;
  status: SabcheckoutSessionStatus;
  providerSessionId?: string;
  paymentRef?: string;
  completedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SabcheckoutSessionListParams {
  page?: number;
  limit?: number;
  status?: SabcheckoutSessionStatus | 'all';
  pageId?: string;
  q?: string;
}

export interface SabcheckoutSessionListResponse {
  items: SabcheckoutSessionDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface SabcheckoutPublicCreateSessionInput {
  pageSlug: string;
  payerEmail?: string;
  payerName?: string;
  payerPhone?: string;
  customFieldsJson?: Record<string, unknown>;
  selectedItems: SabcheckoutSelectedItem[];
  totals: SabcheckoutSessionTotals;
}

export interface SabcheckoutPublicConfirmSessionInput {
  sessionId: string;
  status: SabcheckoutSessionStatus;
  paymentRef?: string;
  providerSessionId?: string;
}

function buildListQuery(p?: SabcheckoutSessionListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.status) qs.set('status', p.status);
  if (p.pageId) qs.set('pageId', p.pageId);
  if (p.q) qs.set('q', p.q);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const sabcheckoutSessionsApi = {
  list: (params?: SabcheckoutSessionListParams) =>
    rustFetch<SabcheckoutSessionListResponse>(
      `/v1/sabcheckout/sessions${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<SabcheckoutSessionDoc>(
      `/v1/sabcheckout/sessions/${encodeURIComponent(id)}`,
    ),
  /** Public — unauthenticated session create from `/pay/[pageSlug]`. */
  publicCreate: (input: SabcheckoutPublicCreateSessionInput) =>
    rustFetch<{ id: string; session: SabcheckoutSessionDoc }>(
      '/v1/sabcheckout/sessions/public',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  /** Public — gateway-return callback flips status + stores refs. */
  publicConfirm: (input: SabcheckoutPublicConfirmSessionInput) =>
    rustFetch<{ session: SabcheckoutSessionDoc }>(
      '/v1/sabcheckout/sessions/public/confirm',
      { method: 'POST', body: JSON.stringify(input) },
    ),
};
