import 'server-only';

/**
 * SabBackstage Orders client — wraps `/v1/sabbackstage/orders`.
 *
 * Counterpart of the Rust crate `sabbackstage-orders`. Admin reads +
 * status patches. Public creation + confirmation are unauthenticated
 * — they back the public checkout flow at `/event/[slug]/checkout`.
 */
import { rustFetch } from './fetcher';

export type SabbackstageOrderStatus =
  | 'pending'
  | 'paid'
  | 'failed'
  | 'refunded';

export interface SabbackstageOrderItem {
  typeId: string;
  qty: number;
  priceMinor: number;
  label?: string;
}

export interface SabbackstageOrderTotals {
  subtotalMinor: number;
  taxMinor: number;
  discountMinor: number;
  totalMinor: number;
  currency: string;
}

export interface SabbackstageOrderDoc {
  _id: string;
  userId: string;
  eventId: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone?: string;
  items: SabbackstageOrderItem[];
  totals: SabbackstageOrderTotals;
  status: SabbackstageOrderStatus;
  paymentRef?: string;
  completedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SabbackstageOrderListParams {
  page?: number;
  limit?: number;
  q?: string;
  eventId?: string;
  status?: SabbackstageOrderStatus | 'all';
}

export interface SabbackstageOrderListResponse {
  items: SabbackstageOrderDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface SabbackstagePublicCreateOrderInput {
  eventId: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone?: string;
  items: { typeId: string; qty: number }[];
}

export interface SabbackstageOrderUpdateInput {
  buyerName?: string;
  buyerEmail?: string;
  buyerPhone?: string;
  status?: SabbackstageOrderStatus;
  paymentRef?: string;
  items?: SabbackstageOrderItem[];
  totals?: SabbackstageOrderTotals;
}

function buildListQuery(p?: SabbackstageOrderListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.eventId) qs.set('eventId', p.eventId);
  if (p.status) qs.set('status', p.status);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const sabbackstageOrdersApi = {
  list: (params?: SabbackstageOrderListParams) =>
    rustFetch<SabbackstageOrderListResponse>(
      `/v1/sabbackstage/orders${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<SabbackstageOrderDoc>(
      `/v1/sabbackstage/orders/${encodeURIComponent(id)}`,
    ),
  update: (id: string, patch: SabbackstageOrderUpdateInput) =>
    rustFetch<SabbackstageOrderDoc>(
      `/v1/sabbackstage/orders/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/sabbackstage/orders/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
  publicCreate: (input: SabbackstagePublicCreateOrderInput) =>
    rustFetch<{ id: string; entity: SabbackstageOrderDoc }>(
      '/v1/sabbackstage/orders/public/create',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  publicConfirm: (id: string, paymentRef: string) =>
    rustFetch<SabbackstageOrderDoc>(
      `/v1/sabbackstage/orders/public/${encodeURIComponent(id)}/confirm`,
      { method: 'POST', body: JSON.stringify({ paymentRef }) },
    ),
  publicGetById: (id: string) =>
    rustFetch<SabbackstageOrderDoc>(
      `/v1/sabbackstage/orders/public/${encodeURIComponent(id)}`,
    ),
};
