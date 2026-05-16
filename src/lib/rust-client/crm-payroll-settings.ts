import 'server-only';

/**
 * CRM Payroll Settings client — wraps `/v1/crm/payroll-settings`.
 */
import { rustFetch } from './fetcher';

export type CrmPayrollSettingStatus = 'active' | 'archived';
export type CrmPayrollSettingPayCycle = 'monthly' | 'weekly' | 'biweekly';

export interface CrmPayrollSettingTaxSlab {
  min?: number;
  max?: number;
  rate?: number;
  [key: string]: unknown;
}

export interface CrmPayrollSettingDoc {
  _id: string;
  userId?: string;
  companyName?: string;
  pfRate?: number;
  esiRate?: number;
  payCycle: CrmPayrollSettingPayCycle;
  taxSlabs?: CrmPayrollSettingTaxSlab[];
  defaultCurrency?: string;
  status: CrmPayrollSettingStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmPayrollSettingListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmPayrollSettingStatus | 'all';
  payCycle?: CrmPayrollSettingPayCycle;
}

export interface CrmPayrollSettingListResponse {
  items: CrmPayrollSettingDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmPayrollSettingCreateInput {
  companyName?: string;
  pfRate?: number;
  esiRate?: number;
  payCycle?: CrmPayrollSettingPayCycle;
  taxSlabs?: CrmPayrollSettingTaxSlab[];
  defaultCurrency?: string;
}

export type CrmPayrollSettingUpdateInput = Partial<CrmPayrollSettingCreateInput> & {
  status?: CrmPayrollSettingStatus;
};

function buildListQuery(p?: CrmPayrollSettingListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.payCycle) qs.set('payCycle', p.payCycle);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmPayrollSettingsApi = {
  list: (params?: CrmPayrollSettingListParams) =>
    rustFetch<CrmPayrollSettingListResponse>(
      `/v1/crm/payroll-settings${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmPayrollSettingDoc>(
      `/v1/crm/payroll-settings/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmPayrollSettingCreateInput) =>
    rustFetch<{ id: string; entity: CrmPayrollSettingDoc }>(
      '/v1/crm/payroll-settings',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: CrmPayrollSettingUpdateInput) =>
    rustFetch<CrmPayrollSettingDoc>(
      `/v1/crm/payroll-settings/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/payroll-settings/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
