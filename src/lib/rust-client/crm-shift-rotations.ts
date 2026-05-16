import 'server-only';

/**
 * CRM ShiftRotation client — wraps `/v1/crm/shift-rotations`.
 *
 * A shift rotation defines a recurring `pattern` of shifts spanning a
 * `cycleDays`-long cycle, optionally scoped to an employee, department, or team.
 */
import { rustFetch } from './fetcher';

export type CrmShiftRotationStatus =
  | 'active'
  | 'paused'
  | 'completed'
  | 'archived';

export interface CrmShiftRotationDay {
  dayOffset: number;
  shiftId: string;
  shiftName?: string;
  isOff?: boolean;
}

export interface CrmShiftRotationDoc {
  _id: string;
  userId?: string;
  name: string;
  description?: string;
  employeeId?: string;
  departmentId?: string;
  teamId?: string;
  pattern: CrmShiftRotationDay[];
  cycleDays: number;
  startDate: string;
  endDate?: string;
  isActive: boolean;
  status: CrmShiftRotationStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmShiftRotationListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmShiftRotationStatus | 'all';
  employeeId?: string;
  departmentId?: string;
  teamId?: string;
  isActive?: boolean;
}

export interface CrmShiftRotationListResponse {
  items: CrmShiftRotationDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmShiftRotationCreateInput {
  name: string;
  description?: string;
  employeeId?: string;
  departmentId?: string;
  teamId?: string;
  pattern?: CrmShiftRotationDay[];
  cycleDays: number;
  startDate: string;
  endDate?: string;
  isActive?: boolean;
}

export type CrmShiftRotationUpdateInput = Partial<
  Omit<CrmShiftRotationCreateInput, 'cycleDays' | 'startDate'>
> & {
  cycleDays?: number;
  startDate?: string;
  status?: CrmShiftRotationStatus;
};

function buildListQuery(p?: CrmShiftRotationListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.employeeId) qs.set('employeeId', p.employeeId);
  if (p.departmentId) qs.set('departmentId', p.departmentId);
  if (p.teamId) qs.set('teamId', p.teamId);
  if (p.isActive != null) qs.set('isActive', String(p.isActive));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmShiftRotationsApi = {
  list: (params?: CrmShiftRotationListParams) =>
    rustFetch<CrmShiftRotationListResponse>(
      `/v1/crm/shift-rotations${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmShiftRotationDoc>(
      `/v1/crm/shift-rotations/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmShiftRotationCreateInput) =>
    rustFetch<{ id: string; entity: CrmShiftRotationDoc }>(
      '/v1/crm/shift-rotations',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: CrmShiftRotationUpdateInput) =>
    rustFetch<CrmShiftRotationDoc>(
      `/v1/crm/shift-rotations/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/shift-rotations/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
