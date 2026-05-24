import 'server-only';

/**
 * CRM Payslips client — wraps `/v1/crm/payslips`.
 */
import { rustFetch } from './fetcher';

export type CrmPayslipStatus = 'draft' | 'issued' | 'paid' | 'archived';

export interface CrmPayslipDoc {
  _id: string;
  userId?: string;
  employeeId: string;
  employeeName?: string;
  payPeriod: string;
  basic: number;
  hra: number;
  allowances?: number;
  deductions: number;
  pf?: number;
  esi?: number;
  tax?: number;
  gross: number;
  net: number;
  status: CrmPayslipStatus;
  issuedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmPayslipListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmPayslipStatus | 'all';
  employeeId?: string;
  payPeriod?: string;
}

export interface CrmPayslipListResponse {
  items: CrmPayslipDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmPayslipCreateInput {
  employeeId: string;
  employeeName?: string;
  payPeriod: string;
  basic: number;
  hra: number;
  allowances?: number;
  deductions: number;
  pf?: number;
  esi?: number;
  tax?: number;
  gross: number;
  net: number;
  status?: CrmPayslipStatus;
  issuedAt?: string;
}

export type CrmPayslipUpdateInput = Partial<CrmPayslipCreateInput>;

function buildListQuery(p?: CrmPayslipListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.employeeId) qs.set('employeeId', p.employeeId);
  if (p.payPeriod) qs.set('payPeriod', p.payPeriod);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmPayslipsApi = {
  list: (params?: CrmPayslipListParams) =>
    rustFetch<CrmPayslipListResponse>(
      `/v1/crm/payslips${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmPayslipDoc>(
      `/v1/crm/payslips/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmPayslipCreateInput) =>
    rustFetch<{ id: string; entity: CrmPayslipDoc }>(
      '/v1/crm/payslips',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: CrmPayslipUpdateInput) =>
    rustFetch<CrmPayslipDoc>(
      `/v1/crm/payslips/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/payslips/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
  generate: (month: number, year: number) =>
    rustFetch<{ payrollData: any[] }>(
      '/v1/crm/payslips/generate',
      { method: 'POST', body: JSON.stringify({ month, year }) }
    ),
};
