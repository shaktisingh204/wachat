import 'server-only';

/**
 * CRM Coupon client — wraps `/v1/crm/coupons`.
 *
 * Counterpart of the Rust crate `crm-coupons`. Promotional discount
 * codes with usage limits + validity windows + product scoping.
 */
import { rustFetch } from './fetcher';

export type CrmCouponStatus = 'draft' | 'active' | 'expired' | 'archived';
export type CrmCouponType = 'percent' | 'fixed';

export interface CrmCouponDoc {
  _id: string;
  userId?: string;
  code: string;
  type: CrmCouponType | string;
  value: number;
  minCart?: number;
  maxUses?: number;
  perCustomerLimit?: number;
  validFrom?: string;
  validTo?: string;
  applicableProducts?: string[];
  stackable?: boolean;
  status?: CrmCouponStatus;
  usedCount?: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmCouponListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmCouponStatus | 'all';
}

export interface CrmCouponListResponse {
  items: CrmCouponDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmCouponCreateInput {
  code: string;
  type?: CrmCouponType;
  value: number;
  minCart?: number;
  maxUses?: number;
  perCustomerLimit?: number;
  validFrom?: string;
  validTo?: string;
  applicableProducts?: string[];
  stackable?: boolean;
  notes?: string;
}

export type CrmCouponUpdateInput = Partial<CrmCouponCreateInput> & {
  status?: CrmCouponStatus;
};

function buildListQuery(p?: CrmCouponListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmCouponsApi = {
  list: (params?: CrmCouponListParams) =>
    rustFetch<CrmCouponListResponse>(`/v1/crm/coupons${buildListQuery(params)}`),
  getById: (id: string) =>
    rustFetch<CrmCouponDoc>(`/v1/crm/coupons/${encodeURIComponent(id)}`),
  create: (input: CrmCouponCreateInput) =>
    rustFetch<{ id: string; entity: CrmCouponDoc }>('/v1/crm/coupons', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: CrmCouponUpdateInput) =>
    rustFetch<CrmCouponDoc>(`/v1/crm/coupons/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/coupons/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
