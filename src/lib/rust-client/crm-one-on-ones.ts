import 'server-only';

/**
 * CRM OneOnOne client — wraps `/v1/crm/one-on-ones`.
 */
import { rustFetch } from './fetcher';

export type CrmOneOnOneStatus =
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show'
  | 'archived';

export type CrmOneOnOneMood = 'happy' | 'neutral' | 'concerned';

export interface CrmOneOnOneAgendaItem {
  id: string;
  topic: string;
  owner?: string;
  timeMinutes?: number;
  discussed?: boolean;
}

export interface CrmOneOnOneActionItem {
  id: string;
  description: string;
  assigneeId?: string;
  dueDate?: string;
  status: string;
}

export interface CrmOneOnOneDoc {
  _id: string;
  userId?: string;
  managerId: string;
  managerName?: string;
  reportId: string;
  reportName?: string;
  scheduledAt: string;
  durationMinutes?: number;
  location?: string;
  agenda?: CrmOneOnOneAgendaItem[];
  discussionNotes?: string;
  actionItems?: CrmOneOnOneActionItem[];
  mood?: CrmOneOnOneMood;
  engagementScore?: number;
  nextMeetingAt?: string;
  isPrivate: boolean;
  status: CrmOneOnOneStatus;
  completedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmOneOnOneListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmOneOnOneStatus | 'all';
  managerId?: string;
  reportId?: string;
}

export interface CrmOneOnOneListResponse {
  items: CrmOneOnOneDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmOneOnOneCreateInput {
  managerId: string;
  managerName?: string;
  reportId: string;
  reportName?: string;
  scheduledAt: string;
  durationMinutes?: number;
  location?: string;
  agenda?: CrmOneOnOneAgendaItem[];
  discussionNotes?: string;
  actionItems?: CrmOneOnOneActionItem[];
  mood?: CrmOneOnOneMood;
  engagementScore?: number;
  nextMeetingAt?: string;
  isPrivate?: boolean;
}

export type CrmOneOnOneUpdateInput = Partial<CrmOneOnOneCreateInput> & {
  status?: CrmOneOnOneStatus;
};

function buildListQuery(p?: CrmOneOnOneListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.managerId) qs.set('managerId', p.managerId);
  if (p.reportId) qs.set('reportId', p.reportId);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmOneOnOnesApi = {
  list: (params?: CrmOneOnOneListParams) =>
    rustFetch<CrmOneOnOneListResponse>(
      `/v1/crm/one-on-ones${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmOneOnOneDoc>(
      `/v1/crm/one-on-ones/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmOneOnOneCreateInput) =>
    rustFetch<{ id: string; entity: CrmOneOnOneDoc }>(
      '/v1/crm/one-on-ones',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: CrmOneOnOneUpdateInput) =>
    rustFetch<CrmOneOnOneDoc>(
      `/v1/crm/one-on-ones/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/one-on-ones/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
