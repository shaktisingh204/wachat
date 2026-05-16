import 'server-only';

/**
 * CRM Assets client — wraps `/v1/crm/assets`.
 *
 * Operational IT/office asset register (laptops, phones, monitors,
 * badges, keys, vehicles). Distinct from `crm-fixed-assets`, which is
 * the accounting/depreciation view.
 */
import { rustFetch } from './fetcher';

export type CrmAssetStatus =
  | 'available'
  | 'assigned'
  | 'in_repair'
  | 'retired'
  | 'archived';

export type CrmAssetCategory =
  | 'laptop'
  | 'phone'
  | 'monitor'
  | 'badge'
  | 'keys'
  | 'vehicle'
  | 'other';

export type CrmAssetCondition =
  | 'new'
  | 'good'
  | 'fair'
  | 'poor'
  | 'damaged';

export interface CrmAssetDoc {
  _id: string;
  userId?: string;
  assetTag: string;
  name: string;
  category?: CrmAssetCategory | string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  purchaseDate?: string;
  purchasePrice?: number;
  currency?: string;
  warrantyExpiry?: string;
  location?: string;
  branchId?: string;
  currentAssigneeId?: string;
  currentAssigneeName?: string;
  condition?: CrmAssetCondition | string;
  status: CrmAssetStatus;
  notes?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmAssetListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmAssetStatus | 'all';
  category?: CrmAssetCategory | string;
  assigneeId?: string;
}

export interface CrmAssetListResponse {
  items: CrmAssetDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmAssetCreateInput {
  assetTag: string;
  name: string;
  category?: CrmAssetCategory | string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  purchaseDate?: string;
  purchasePrice?: number;
  currency?: string;
  warrantyExpiry?: string;
  location?: string;
  branchId?: string;
  currentAssigneeId?: string;
  currentAssigneeName?: string;
  condition?: CrmAssetCondition | string;
  status?: CrmAssetStatus;
  notes?: string;
  tags?: string[];
}

export type CrmAssetUpdateInput = Partial<
  Omit<CrmAssetCreateInput, 'currentAssigneeId'>
> & {
  /**
   * Patch sentinel: pass `null` to clear the assignee (will auto-flip
   * status to `"available"`), a string to set it (auto-flip to
   * `"assigned"`), or omit to leave unchanged.
   */
  currentAssigneeId?: string | null;
};

function buildListQuery(p?: CrmAssetListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.category) qs.set('category', p.category);
  if (p.assigneeId) qs.set('assigneeId', p.assigneeId);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmAssetsApi = {
  list: (params?: CrmAssetListParams) =>
    rustFetch<CrmAssetListResponse>(
      `/v1/crm/assets${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmAssetDoc>(`/v1/crm/assets/${encodeURIComponent(id)}`),
  create: (input: CrmAssetCreateInput) =>
    rustFetch<{ id: string; entity: CrmAssetDoc }>(
      '/v1/crm/assets',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: CrmAssetUpdateInput) =>
    rustFetch<CrmAssetDoc>(
      `/v1/crm/assets/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/assets/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
