import 'server-only';

/**
 * CRM Exits client — wraps `/v1/crm/exits`.
 */
import { rustFetch } from './fetcher';

export type CrmExitStatus = 'open' | 'complete' | 'cancelled' | 'archived';
export type CrmExitType =
  | 'resignation'
  | 'termination'
  | 'retirement'
  | 'end_of_contract'
  | 'other';

export interface CrmExitDoc {
  _id: string;
  userId?: string;
  employeeName?: string;
  employeeId?: string;
  type: CrmExitType | string;
  noticeStart?: string;
  lastDay?: string;
  fnfStatus: string;
  nocStatus: string;
  assetReturnStatus: string;
  knowledgeTransferStatus: string;
  exitInterviewNotes?: string;
  reason?: string;
  notes?: string;
  status?: CrmExitStatus;
  archived?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmExitListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmExitStatus | 'all';
  type?: CrmExitType | string;
}

export interface CrmExitListResponse {
  items: CrmExitDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmExitCreateInput {
  employeeName?: string;
  employeeId?: string;
  type?: CrmExitType | string;
  noticeStart?: string;
  lastDay?: string;
  fnfStatus?: string;
  nocStatus?: string;
  assetReturnStatus?: string;
  knowledgeTransferStatus?: string;
  exitInterviewNotes?: string;
  reason?: string;
  notes?: string;
}

export type CrmExitUpdateInput = Partial<CrmExitCreateInput> & {
  status?: CrmExitStatus;
};

function buildListQuery(p?: CrmExitListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.type) qs.set('type', p.type);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmExitsApi = {
  list: (params?: CrmExitListParams) =>
    rustFetch<CrmExitListResponse>(`/v1/crm/exits${buildListQuery(params)}`),
  getById: (id: string) =>
    rustFetch<CrmExitDoc>(`/v1/crm/exits/${encodeURIComponent(id)}`),
  create: (input: CrmExitCreateInput) =>
    rustFetch<{ id: string; entity: CrmExitDoc }>('/v1/crm/exits', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: CrmExitUpdateInput) =>
    rustFetch<CrmExitDoc>(`/v1/crm/exits/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(`/v1/crm/exits/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
};
