import 'server-only';

/**
 * CRM Stock Adjustment client — wraps `/v1/crm/stock-adjustments`.
 *
 * Counterpart of the Rust crate `crm-stock-adjustments`. Mirrors the
 * legacy TS `CrmStockAdjustment` shape with per-line breakdowns and an
 * approval workflow.
 */
import { rustFetch } from './fetcher';

export type CrmStockAdjustmentStatus = 'pending' | 'approved' | 'rejected';

export interface CrmStockAdjustmentLineDoc {
  productId: string;
  productName?: string;
  qtyBefore?: number;
  qtyAfter?: number;
  delta?: number;
  batch?: string;
  serial?: string;
  costPerUnit?: number;
}

export interface CrmStockAdjustmentDoc {
  _id: string;
  userId?: string;
  adjustmentNumber?: string;
  date: string;
  reason: string;
  referenceNumber?: string;
  warehouseId: string;
  productId: string;
  quantity: number;
  costPerUnit?: number;
  lines?: CrmStockAdjustmentLineDoc[];
  status?: CrmStockAdjustmentStatus;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string;
  approvalNotes?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmStockAdjustmentListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmStockAdjustmentStatus | 'all';
  warehouseId?: string;
  productId?: string;
  /** Inclusive lower bound (ISO-8601). */
  dateFrom?: string;
  /** Exclusive upper bound (ISO-8601). */
  dateTo?: string;
}

export interface CrmStockAdjustmentListResponse {
  items: CrmStockAdjustmentDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmStockAdjustmentCreateInput {
  adjustmentNumber?: string;
  date?: string;
  reason: string;
  referenceNumber?: string;
  warehouseId: string;
  productId: string;
  quantity: number;
  costPerUnit?: number;
  lines?: CrmStockAdjustmentLineDoc[];
  status?: CrmStockAdjustmentStatus;
  notes?: string;
}

export type CrmStockAdjustmentUpdateInput = Partial<CrmStockAdjustmentCreateInput>;

export interface CrmStockAdjustmentApprovalInput {
  decision: 'approve' | 'reject';
  notes?: string;
}

function buildListQuery(p?: CrmStockAdjustmentListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.warehouseId) qs.set('warehouseId', p.warehouseId);
  if (p.productId) qs.set('productId', p.productId);
  if (p.dateFrom) qs.set('dateFrom', p.dateFrom);
  if (p.dateTo) qs.set('dateTo', p.dateTo);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmStockAdjustmentsApi = {
  list: (params?: CrmStockAdjustmentListParams) =>
    rustFetch<CrmStockAdjustmentListResponse>(
      `/v1/crm/stock-adjustments${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmStockAdjustmentDoc>(
      `/v1/crm/stock-adjustments/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmStockAdjustmentCreateInput) =>
    rustFetch<{ id: string; entity: CrmStockAdjustmentDoc }>(
      '/v1/crm/stock-adjustments',
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
    ),
  update: (id: string, patch: CrmStockAdjustmentUpdateInput) =>
    rustFetch<CrmStockAdjustmentDoc>(
      `/v1/crm/stock-adjustments/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(patch),
      },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/stock-adjustments/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
  approval: (id: string, input: CrmStockAdjustmentApprovalInput) =>
    rustFetch<CrmStockAdjustmentDoc>(
      `/v1/crm/stock-adjustments/${encodeURIComponent(id)}/approval`,
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
    ),
};
