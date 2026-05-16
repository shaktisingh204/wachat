import 'server-only';

/**
 * CRM Purchases client — wraps `/v1/crm/purchases`.
 *
 * Mirrors the on-disk shape of a `crm_purchases` document. Purchase
 * transactions are distinct from purchase orders: a Purchase here is a
 * recorded transaction (often a bill/receipt), not a pre-committal order.
 */
import { rustFetch } from './fetcher';

export type CrmPurchaseStatus =
  | 'draft'
  | 'received'
  | 'paid'
  | 'cancelled'
  | 'archived';

export interface CrmPurchaseLineItem {
  [key: string]: unknown;
}

export interface CrmPurchaseDoc {
  _id: string;
  userId?: string;
  purchaseNumber: string;
  vendorId?: string;
  vendorName?: string;
  purchaseDate: string;
  items?: CrmPurchaseLineItem[];
  subtotal: number;
  taxTotal?: number;
  total: number;
  status: CrmPurchaseStatus;
  notes?: string;
  currency?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmPurchaseListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmPurchaseStatus | 'all';
  vendorId?: string;
}

export interface CrmPurchaseListResponse {
  items: CrmPurchaseDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmPurchaseCreateInput {
  purchaseNumber: string;
  vendorId?: string;
  vendorName?: string;
  purchaseDate?: string;
  items?: CrmPurchaseLineItem[];
  subtotal?: number;
  taxTotal?: number;
  total?: number;
  status?: CrmPurchaseStatus;
  notes?: string;
  currency?: string;
}

export type CrmPurchaseUpdateInput = Partial<CrmPurchaseCreateInput>;

function buildListQuery(p?: CrmPurchaseListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.vendorId) qs.set('vendorId', p.vendorId);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmPurchasesApi = {
  list: (params?: CrmPurchaseListParams) =>
    rustFetch<CrmPurchaseListResponse>(
      `/v1/crm/purchases${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmPurchaseDoc>(
      `/v1/crm/purchases/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmPurchaseCreateInput) =>
    rustFetch<{ id: string; entity: CrmPurchaseDoc }>(
      '/v1/crm/purchases',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: CrmPurchaseUpdateInput) =>
    rustFetch<CrmPurchaseDoc>(
      `/v1/crm/purchases/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/purchases/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
