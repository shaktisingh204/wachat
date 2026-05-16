import 'server-only';

/**
 * CRM Production Orders client — wraps `/v1/crm/production-orders`.
 */
import { rustFetch } from './fetcher';

export type CrmProductionOrderStatus =
  | 'planned'
  | 'in_progress'
  | 'complete'
  | 'cancelled'
  | 'archived';

export interface CrmProductionComponent {
  itemId?: string;
  itemName: string;
  qty: number;
  unit: string;
  scrapPct?: number;
  costPerUnit?: number;
}

export interface CrmProductionOrderDoc {
  _id: string;
  userId?: string;
  orderNo: string;
  bomRef?: string;
  bomId?: string;
  finishedGoodId?: string;
  finishedGoodName: string;
  plannedQty: number;
  actualYield?: number;
  scrap?: number;
  unit: string;
  plannedStart?: string;
  plannedEnd?: string;
  machineId?: string;
  machineOperator?: string;
  machineOperatorId?: string;
  notes?: string;
  status?: CrmProductionOrderStatus;
  components: CrmProductionComponent[];
  labourCost?: number;
  overheadCost?: number;
  materialCost?: number;
  totalCost?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmProductionOrderListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmProductionOrderStatus | 'all';
  bomId?: string;
}

export interface CrmProductionOrderListResponse {
  items: CrmProductionOrderDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmProductionOrderCreateInput {
  orderNo?: string;
  bomRef?: string;
  bomId?: string;
  finishedGoodId?: string;
  finishedGoodName: string;
  plannedQty: number;
  unit: string;
  plannedStart?: string;
  plannedEnd?: string;
  machineId?: string;
  machineOperator?: string;
  machineOperatorId?: string;
  notes?: string;
  components?: CrmProductionComponent[];
  labourCost?: number;
  overheadCost?: number;
}

export type CrmProductionOrderUpdateInput =
  Partial<CrmProductionOrderCreateInput> & {
    status?: CrmProductionOrderStatus;
    actualYield?: number;
    scrap?: number;
    materialCost?: number;
    totalCost?: number;
  };

function buildListQuery(p?: CrmProductionOrderListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.bomId) qs.set('bomId', p.bomId);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmProductionOrdersApi = {
  list: (params?: CrmProductionOrderListParams) =>
    rustFetch<CrmProductionOrderListResponse>(
      `/v1/crm/production-orders${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmProductionOrderDoc>(
      `/v1/crm/production-orders/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmProductionOrderCreateInput) =>
    rustFetch<{ id: string; entity: CrmProductionOrderDoc }>(
      '/v1/crm/production-orders',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: CrmProductionOrderUpdateInput) =>
    rustFetch<CrmProductionOrderDoc>(
      `/v1/crm/production-orders/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/production-orders/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
