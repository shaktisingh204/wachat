import 'server-only';

/**
 * CRM Salary Structures client — wraps `/v1/crm/salary-structures`.
 */
import { rustFetch } from './fetcher';

export type CrmSalaryStructureStatus = 'active' | 'archived';

export interface CrmSalaryStructureDoc {
  _id: string;
  userId?: string;
  employeeId: string;
  employeeName?: string;
  effectiveFrom?: string;
  basic: number;
  hra?: number;
  da?: number;
  otherAllowances?: number;
  pfEmployer?: number;
  pfEmployee?: number;
  esi?: number;
  professionalTax?: number;
  gross?: number;
  net?: number;
  status: CrmSalaryStructureStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmSalaryStructureListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmSalaryStructureStatus | 'all';
  employeeId?: string;
}

export interface CrmSalaryStructureListResponse {
  items: CrmSalaryStructureDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmSalaryStructureCreateInput {
  employeeId: string;
  employeeName?: string;
  effectiveFrom?: string;
  basic: number;
  hra?: number;
  da?: number;
  otherAllowances?: number;
  pfEmployer?: number;
  pfEmployee?: number;
  esi?: number;
  professionalTax?: number;
  gross?: number;
  net?: number;
}

export type CrmSalaryStructureUpdateInput = Partial<CrmSalaryStructureCreateInput> & {
  status?: CrmSalaryStructureStatus;
};

function buildListQuery(p?: CrmSalaryStructureListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.employeeId) qs.set('employeeId', p.employeeId);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmSalaryStructuresApi = {
  list: (params?: CrmSalaryStructureListParams) =>
    rustFetch<CrmSalaryStructureListResponse>(
      `/v1/crm/salary-structures${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmSalaryStructureDoc>(
      `/v1/crm/salary-structures/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmSalaryStructureCreateInput) =>
    rustFetch<{ id: string; entity: CrmSalaryStructureDoc }>(
      '/v1/crm/salary-structures',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: CrmSalaryStructureUpdateInput) =>
    rustFetch<CrmSalaryStructureDoc>(
      `/v1/crm/salary-structures/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/salary-structures/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
