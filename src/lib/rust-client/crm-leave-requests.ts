import 'server-only';

/**
 * CRM Leave Requests client — wraps `/v1/crm/leave-requests`.
 *
 * Backs the legacy `crm_leave_requests` collection (employee leave
 * applications). Distinct from `crm-leaves`, which manages the
 * leave-type catalog and the newer `crm_leave_applications` records.
 */
import { rustFetch } from './fetcher';

export type CrmLeaveRequestStatus =
  | 'Pending'
  | 'Approved'
  | 'Rejected'
  | 'Cancelled'
  | 'archived';

export interface CrmLeaveRequestDoc {
  _id: string;
  userId?: string;
  employeeId: string;
  employeeName?: string;
  leaveType?: string;
  leaveTypeId?: string;
  startDate: string;
  endDate: string;
  days: number;
  reason?: string;
  status: CrmLeaveRequestStatus;
  approverId?: string;
  approvedAt?: string;
  comments?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmLeaveRequestListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmLeaveRequestStatus | 'all';
  employeeId?: string;
  leaveType?: string;
}

export interface CrmLeaveRequestListResponse {
  items: CrmLeaveRequestDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmLeaveRequestCreateInput {
  employeeId: string;
  employeeName?: string;
  leaveType?: string;
  leaveTypeId?: string;
  /** RFC3339 datetime or `YYYY-MM-DD`. */
  startDate: string;
  /** RFC3339 datetime or `YYYY-MM-DD`. */
  endDate: string;
  /** Positive number; half-days allowed. */
  days: number;
  reason?: string;
  status?: CrmLeaveRequestStatus;
  comments?: string;
}

export type CrmLeaveRequestUpdateInput = Partial<CrmLeaveRequestCreateInput> & {
  approverId?: string;
  approvedAt?: string;
};

function buildListQuery(p?: CrmLeaveRequestListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.employeeId) qs.set('employeeId', p.employeeId);
  if (p.leaveType) qs.set('leaveType', p.leaveType);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmLeaveRequestsApi = {
  list: (params?: CrmLeaveRequestListParams) =>
    rustFetch<CrmLeaveRequestListResponse>(
      `/v1/crm/leave-requests${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmLeaveRequestDoc>(
      `/v1/crm/leave-requests/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmLeaveRequestCreateInput) =>
    rustFetch<{ id: string; entity: CrmLeaveRequestDoc }>(
      '/v1/crm/leave-requests',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: CrmLeaveRequestUpdateInput) =>
    rustFetch<CrmLeaveRequestDoc>(
      `/v1/crm/leave-requests/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/leave-requests/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
