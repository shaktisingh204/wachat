import 'server-only';

/**
 * CRM Asset Assignment client — wraps `/v1/crm/asset-assignments`.
 *
 * Note: the Rust crate uses snake_case BSON for the asset/employee
 * reference fields (`asset_id`, `employee_id`, etc.) and camelCase for
 * the standard envelope fields (`createdAt`, `updatedAt`, `userId`).
 */
import { rustFetch } from './fetcher';

export type CrmAssetAssignmentStatus =
  | 'assigned'
  | 'returned'
  | 'lost'
  | 'damaged'
  | 'archived';

export type CrmAssetCondition =
  | 'new'
  | 'good'
  | 'fair'
  | 'poor'
  | 'damaged';

export interface CrmAssetAssignmentDoc {
  _id: string;
  userId?: string;
  asset_id: string;
  asset_name?: string;
  employee_id: string;
  employee_name?: string;
  assigned_at?: string;
  returned_at?: string | null;
  condition_at_assign?: CrmAssetCondition | string;
  condition_at_return?: CrmAssetCondition | string | null;
  notes?: string;
  status: CrmAssetAssignmentStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmAssetAssignmentListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmAssetAssignmentStatus | 'all';
  assetId?: string;
  employeeId?: string;
}

export interface CrmAssetAssignmentListResponse {
  items: CrmAssetAssignmentDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmAssetAssignmentCreateInput {
  asset_id: string;
  asset_name?: string;
  employee_id: string;
  employee_name?: string;
  assigned_at?: string;
  returned_at?: string | null;
  condition_at_assign?: CrmAssetCondition | string;
  condition_at_return?: CrmAssetCondition | string | null;
  notes?: string;
  status?: CrmAssetAssignmentStatus;
}

export type CrmAssetAssignmentUpdateInput = Partial<CrmAssetAssignmentCreateInput>;

function buildListQuery(p?: CrmAssetAssignmentListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.assetId) qs.set('assetId', p.assetId);
  if (p.employeeId) qs.set('employeeId', p.employeeId);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmAssetAssignmentsApi = {
  list: (params?: CrmAssetAssignmentListParams) =>
    rustFetch<CrmAssetAssignmentListResponse>(
      `/v1/crm/asset-assignments${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmAssetAssignmentDoc>(
      `/v1/crm/asset-assignments/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmAssetAssignmentCreateInput) =>
    rustFetch<{ id: string; entity: CrmAssetAssignmentDoc }>(
      '/v1/crm/asset-assignments',
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
    ),
  update: (id: string, patch: CrmAssetAssignmentUpdateInput) =>
    rustFetch<CrmAssetAssignmentDoc>(
      `/v1/crm/asset-assignments/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(patch),
      },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/asset-assignments/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
