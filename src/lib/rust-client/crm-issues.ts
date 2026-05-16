import 'server-only';

/**
 * CRM Issues client — wraps `/v1/crm/issues`.
 */
import { rustFetch } from './fetcher';

export type CrmIssueStatus =
  | 'open'
  | 'in_progress'
  | 'resolved'
  | 'closed'
  | 'archived';

export type CrmIssueType = 'bug' | 'feature' | 'task' | 'epic' | 'story';

export type CrmIssuePriority = 'low' | 'medium' | 'high' | 'critical';

export interface CrmIssueDoc {
  _id: string;
  userId?: string;
  title: string;
  description?: string;
  projectId?: string;
  milestoneId?: string;
  assigneeId?: string;
  reporterId?: string;
  issueType: CrmIssueType;
  priority: CrmIssuePriority;
  severity?: string;
  status: CrmIssueStatus;
  labels?: string[];
  dueDate?: string;
  resolvedAt?: string;
  resolution?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmIssueListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmIssueStatus | 'all';
  issueType?: CrmIssueType;
  priority?: CrmIssuePriority;
  projectId?: string;
  assigneeId?: string;
}

export interface CrmIssueListResponse {
  items: CrmIssueDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmIssueCreateInput {
  title: string;
  description?: string;
  projectId?: string;
  milestoneId?: string;
  assigneeId?: string;
  reporterId?: string;
  issueType?: CrmIssueType;
  priority?: CrmIssuePriority;
  severity?: string;
  labels?: string[];
  dueDate?: string;
}

export type CrmIssueUpdateInput = Partial<CrmIssueCreateInput> & {
  status?: CrmIssueStatus;
  resolvedAt?: string;
  resolution?: string;
};

function buildListQuery(p?: CrmIssueListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.issueType) qs.set('issueType', p.issueType);
  if (p.priority) qs.set('priority', p.priority);
  if (p.projectId) qs.set('projectId', p.projectId);
  if (p.assigneeId) qs.set('assigneeId', p.assigneeId);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmIssuesApi = {
  list: (params?: CrmIssueListParams) =>
    rustFetch<CrmIssueListResponse>(
      `/v1/crm/issues${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmIssueDoc>(
      `/v1/crm/issues/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmIssueCreateInput) =>
    rustFetch<{ id: string; entity: CrmIssueDoc }>(
      '/v1/crm/issues',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: CrmIssueUpdateInput) =>
    rustFetch<CrmIssueDoc>(
      `/v1/crm/issues/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/issues/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
