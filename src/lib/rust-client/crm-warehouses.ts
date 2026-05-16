import 'server-only';

/**
 * CRM Warehouse client — wraps `/v1/crm/warehouses`.
 *
 * Counterpart of the Rust crate `crm-warehouses`. Mirrors the legacy
 * TS `CrmWarehouse` shape.
 */
import { rustFetch } from './fetcher';

export type CrmWarehouseType = 'main' | 'branch' | 'franchise' | '3pl' | 'virtual';
export type CrmWarehouseStatus = 'active' | 'inactive' | 'archived';

export interface CrmWarehouseDoc {
  _id: string;
  userId?: string;
  name: string;
  code?: string;
  type?: CrmWarehouseType;
  status?: CrmWarehouseStatus;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  phone?: string;
  managerId?: string;
  managerName?: string;
  gstin?: string;
  capacityUnits?: number;
  capacitySqft?: number;
  climateControlled?: boolean;
  isDefault?: boolean;
  archived?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmWarehouseListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmWarehouseStatus | 'all';
  type?: CrmWarehouseType;
  city?: string;
}

export interface CrmWarehouseListResponse {
  items: CrmWarehouseDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmWarehouseCreateInput {
  name: string;
  code?: string;
  type?: CrmWarehouseType;
  status?: CrmWarehouseStatus;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  phone?: string;
  managerId?: string;
  managerName?: string;
  gstin?: string;
  capacityUnits?: number;
  capacitySqft?: number;
  climateControlled?: boolean;
  isDefault?: boolean;
}

export type CrmWarehouseUpdateInput = Partial<CrmWarehouseCreateInput> & {
  archived?: boolean;
};

function buildListQuery(p?: CrmWarehouseListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.type) qs.set('type', p.type);
  if (p.city) qs.set('city', p.city);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmWarehousesApi = {
  list: (params?: CrmWarehouseListParams) =>
    rustFetch<CrmWarehouseListResponse>(`/v1/crm/warehouses${buildListQuery(params)}`),
  getById: (id: string) =>
    rustFetch<CrmWarehouseDoc>(`/v1/crm/warehouses/${encodeURIComponent(id)}`),
  create: (input: CrmWarehouseCreateInput) =>
    rustFetch<{ id: string; entity: CrmWarehouseDoc }>('/v1/crm/warehouses', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: CrmWarehouseUpdateInput) =>
    rustFetch<CrmWarehouseDoc>(`/v1/crm/warehouses/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/warehouses/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
