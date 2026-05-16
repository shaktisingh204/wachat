import 'server-only';

/**
 * CRM Shifts client — wraps `/v1/crm/shifts`.
 */
import { rustFetch } from './fetcher';

export type CrmShiftStatus = 'active' | 'archived';

export interface CrmShiftDoc {
  _id: string;
  userId?: string;
  name: string;
  code?: string;
  startTime: string;
  endTime: string;
  breakMinutes?: number;
  graceMinutes?: number;
  isNightShift?: boolean;
  workingDays?: string[];
  color?: string;
  description?: string;
  isDefault?: boolean;
  departmentIds?: string[];
  isActive?: boolean;
  status: CrmShiftStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmShiftListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmShiftStatus | 'all';
  isActive?: boolean;
  isDefault?: boolean;
  departmentId?: string;
}

export interface CrmShiftListResponse {
  items: CrmShiftDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmShiftCreateInput {
  name: string;
  code?: string;
  startTime: string;
  endTime: string;
  breakMinutes?: number;
  graceMinutes?: number;
  isNightShift?: boolean;
  workingDays?: string[];
  color?: string;
  description?: string;
  isDefault?: boolean;
  departmentIds?: string[];
  isActive?: boolean;
}

export type CrmShiftUpdateInput = Partial<CrmShiftCreateInput> & {
  status?: CrmShiftStatus;
};

function buildListQuery(p?: CrmShiftListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.isActive != null) qs.set('isActive', String(p.isActive));
  if (p.isDefault != null) qs.set('isDefault', String(p.isDefault));
  if (p.departmentId) qs.set('departmentId', p.departmentId);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmShiftsApi = {
  list: (params?: CrmShiftListParams) =>
    rustFetch<CrmShiftListResponse>(
      `/v1/crm/shifts${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmShiftDoc>(`/v1/crm/shifts/${encodeURIComponent(id)}`),
  create: (input: CrmShiftCreateInput) =>
    rustFetch<{ id: string; entity: CrmShiftDoc }>('/v1/crm/shifts', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: CrmShiftUpdateInput) =>
    rustFetch<CrmShiftDoc>(`/v1/crm/shifts/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/shifts/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
