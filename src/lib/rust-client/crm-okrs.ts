import 'server-only';

/**
 * CRM OKRs client — wraps `/v1/crm/okrs`.
 */
import { rustFetch } from './fetcher';

export type CrmOkrStatus =
  | 'draft'
  | 'in_progress'
  | 'on_track'
  | 'at_risk'
  | 'off_track'
  | 'completed'
  | 'cancelled'
  | 'archived';

export type CrmOkrKeyResultStatus =
  | 'on_track'
  | 'at_risk'
  | 'off_track'
  | 'completed';

export interface CrmOkrKeyResult {
  id: string;
  title: string;
  metric?: string;
  targetValue?: number;
  currentValue?: number;
  unit?: string;
  weight?: number;
  status: CrmOkrKeyResultStatus;
}

export interface CrmOkrDoc {
  _id: string;
  userId?: string;
  objective: string;
  description?: string;
  period?: string;
  ownerId?: string;
  ownerName?: string;
  teamId?: string;
  departmentId?: string;
  parentOkrId?: string;
  keyResults?: CrmOkrKeyResult[];
  progress: number;
  confidence?: number;
  status: CrmOkrStatus;
  startDate?: string;
  endDate?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmOkrListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmOkrStatus | 'all';
  period?: string;
  ownerId?: string;
  departmentId?: string;
}

export interface CrmOkrListResponse {
  items: CrmOkrDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmOkrCreateInput {
  objective: string;
  description?: string;
  period?: string;
  ownerId?: string;
  ownerName?: string;
  teamId?: string;
  departmentId?: string;
  parentOkrId?: string;
  keyResults?: CrmOkrKeyResult[];
  progress?: number;
  confidence?: number;
  status?: CrmOkrStatus;
  startDate?: string;
  endDate?: string;
  tags?: string[];
}

export type CrmOkrUpdateInput = Partial<CrmOkrCreateInput>;

function buildListQuery(p?: CrmOkrListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.period) qs.set('period', p.period);
  if (p.ownerId) qs.set('ownerId', p.ownerId);
  if (p.departmentId) qs.set('departmentId', p.departmentId);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmOkrsApi = {
  list: (params?: CrmOkrListParams) =>
    rustFetch<CrmOkrListResponse>(`/v1/crm/okrs${buildListQuery(params)}`),
  getById: (id: string) =>
    rustFetch<CrmOkrDoc>(`/v1/crm/okrs/${encodeURIComponent(id)}`),
  create: (input: CrmOkrCreateInput) =>
    rustFetch<{ id: string; entity: CrmOkrDoc }>('/v1/crm/okrs', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: CrmOkrUpdateInput) =>
    rustFetch<CrmOkrDoc>(`/v1/crm/okrs/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/okrs/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
