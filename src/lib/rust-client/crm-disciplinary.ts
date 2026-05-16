import 'server-only';

/**
 * CRM Disciplinary client — wraps `/v1/crm/disciplinary`.
 */
import { rustFetch } from './fetcher';

export type CrmDisciplinaryStatus =
  | 'open'
  | 'investigating'
  | 'resolved'
  | 'closed'
  | 'archived';

export interface CrmDisciplinaryHearing {
  date: string;
  outcome?: string;
  notes?: string;
}

export interface CrmDisciplinaryCaseDoc {
  _id: string;
  userId?: string;
  employeeName: string;
  employeeId?: string;
  caseType: string;
  severity: string;
  raisedBy?: string;
  incidentDate?: string;
  description?: string;
  notes?: string;
  evidence?: string[];
  hearings?: CrmDisciplinaryHearing[];
  status: CrmDisciplinaryStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmDisciplinaryListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmDisciplinaryStatus | 'all';
  severity?: string;
  caseType?: string;
}

export interface CrmDisciplinaryListResponse {
  items: CrmDisciplinaryCaseDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmDisciplinaryCreateInput {
  employeeName: string;
  employeeId?: string;
  caseType?: string;
  severity?: string;
  raisedBy?: string;
  incidentDate?: string;
  description?: string;
  notes?: string;
}

export type CrmDisciplinaryUpdateInput = Partial<CrmDisciplinaryCreateInput> & {
  status?: CrmDisciplinaryStatus;
  evidence?: string[];
  hearings?: CrmDisciplinaryHearing[];
};

function buildListQuery(p?: CrmDisciplinaryListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.severity) qs.set('severity', p.severity);
  if (p.caseType) qs.set('caseType', p.caseType);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmDisciplinaryApi = {
  list: (params?: CrmDisciplinaryListParams) =>
    rustFetch<CrmDisciplinaryListResponse>(
      `/v1/crm/disciplinary${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmDisciplinaryCaseDoc>(
      `/v1/crm/disciplinary/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmDisciplinaryCreateInput) =>
    rustFetch<{ id: string; entity: CrmDisciplinaryCaseDoc }>(
      '/v1/crm/disciplinary',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: CrmDisciplinaryUpdateInput) =>
    rustFetch<CrmDisciplinaryCaseDoc>(
      `/v1/crm/disciplinary/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/disciplinary/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
