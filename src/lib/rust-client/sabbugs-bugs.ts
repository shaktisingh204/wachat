import 'server-only';

/**
 * SabBugs — Bugs rust-client. Wraps `/v1/sabbugs/bugs`.
 *
 * The Bug entity is the central unit of the internal SabBugs developer
 * tracker. It links to a Project (reused from CRM Projects) by
 * `projectId` and to optional release Versions by id; attachments are
 * SabFiles ids.
 */
import { rustFetch } from './fetcher';

export type BugStatus =
  | 'open'
  | 'in_progress'
  | 'fixed'
  | 'verified'
  | 'reopened'
  | 'closed';

export type BugSeverity = 'trivial' | 'minor' | 'major' | 'critical' | 'blocker';

export type BugPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface BugDoc {
  _id: string;
  userId?: string;
  projectId?: string;
  title: string;
  description?: string;
  reproSteps?: string;
  environment?: string;
  severity: BugSeverity;
  priority: BugPriority;
  status: BugStatus;
  reporterId?: string;
  assigneeId?: string;
  affectedVersions?: string[];
  fixedInVersion?: string;
  attachmentIds?: string[];
  labels?: string[];
  relatedBugIds?: string[];
  dueDate?: string;
  resolvedAt?: string;
  verifiedAt?: string;
  closedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BugListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: BugStatus | 'all';
  severity?: BugSeverity;
  priority?: BugPriority;
  projectId?: string;
  assigneeId?: string;
  reporterId?: string;
  versionId?: string;
  mine?: boolean;
}

export interface BugListResponse {
  items: BugDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface BugCreateInput {
  title: string;
  description?: string;
  reproSteps?: string;
  environment?: string;
  projectId?: string;
  severity?: BugSeverity;
  priority?: BugPriority;
  reporterId?: string;
  assigneeId?: string;
  affectedVersions?: string[];
  fixedInVersion?: string;
  attachmentIds?: string[];
  labels?: string[];
  relatedBugIds?: string[];
  dueDate?: string;
}

export type BugUpdateInput = Partial<BugCreateInput> & {
  status?: BugStatus;
};

function buildListQuery(p?: BugListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.severity) qs.set('severity', p.severity);
  if (p.priority) qs.set('priority', p.priority);
  if (p.projectId) qs.set('projectId', p.projectId);
  if (p.assigneeId) qs.set('assigneeId', p.assigneeId);
  if (p.reporterId) qs.set('reporterId', p.reporterId);
  if (p.versionId) qs.set('versionId', p.versionId);
  if (p.mine) qs.set('mine', 'true');
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const sabbugsBugsApi = {
  list: (params?: BugListParams) =>
    rustFetch<BugListResponse>(`/v1/sabbugs/bugs${buildListQuery(params)}`),
  getById: (id: string) =>
    rustFetch<BugDoc>(`/v1/sabbugs/bugs/${encodeURIComponent(id)}`),
  create: (input: BugCreateInput) =>
    rustFetch<{ id: string; entity: BugDoc }>(`/v1/sabbugs/bugs`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: BugUpdateInput) =>
    rustFetch<BugDoc>(`/v1/sabbugs/bugs/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/sabbugs/bugs/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
