import 'server-only';

/**
 * CRM Time Logs client — wraps `/v1/crm/time-logs`.
 */
import { rustFetch } from './fetcher';

export type CrmTimeLogStatus =
  | 'running'
  | 'stopped'
  | 'approved'
  | 'rejected'
  | 'archived';

export type CrmTimeLogEntityKind =
  | 'task'
  | 'project_task'
  | 'issue'
  | 'ticket';

export interface CrmTimeLogDoc {
  _id: string;
  userId?: string;
  userLogId?: string;
  projectId?: string;
  taskId?: string;
  issueId?: string;
  entityKind?: CrmTimeLogEntityKind;
  entityId?: string;
  startedAt: string;
  endedAt?: string;
  durationMinutes: number;
  description?: string;
  isBillable: boolean;
  hourlyRate?: number;
  status: CrmTimeLogStatus;
  approvedBy?: string;
  approvedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmTimeLogListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmTimeLogStatus | 'all';
  projectId?: string;
  taskId?: string;
  entityKind?: CrmTimeLogEntityKind;
}

export interface CrmTimeLogListResponse {
  items: CrmTimeLogDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmTimeLogCreateInput {
  userLogId?: string;
  projectId?: string;
  taskId?: string;
  issueId?: string;
  entityKind?: CrmTimeLogEntityKind;
  entityId?: string;
  startedAt?: string;
  endedAt?: string;
  durationMinutes?: number;
  description?: string;
  isBillable?: boolean;
  hourlyRate?: number;
  status?: CrmTimeLogStatus;
}

export type CrmTimeLogUpdateInput = Partial<CrmTimeLogCreateInput> & {
  approvedBy?: string;
  approvedAt?: string;
};

function buildListQuery(p?: CrmTimeLogListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.projectId) qs.set('projectId', p.projectId);
  if (p.taskId) qs.set('taskId', p.taskId);
  if (p.entityKind) qs.set('entityKind', p.entityKind);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmTimeLogsApi = {
  list: (params?: CrmTimeLogListParams) =>
    rustFetch<CrmTimeLogListResponse>(
      `/v1/crm/time-logs${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmTimeLogDoc>(
      `/v1/crm/time-logs/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmTimeLogCreateInput) =>
    rustFetch<{ id: string; entity: CrmTimeLogDoc }>(
      '/v1/crm/time-logs',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: CrmTimeLogUpdateInput) =>
    rustFetch<CrmTimeLogDoc>(
      `/v1/crm/time-logs/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/time-logs/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
