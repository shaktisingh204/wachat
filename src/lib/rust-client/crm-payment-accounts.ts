import 'server-only';

/**
 * CRM Payment Accounts client — wraps `/v1/crm/payment-accounts`.
 */
import { rustFetch } from './fetcher';

export type CrmPaymentAccountStatus = 'active' | 'inactive' | 'archived';
export type CrmPaymentAccountType = 'bank' | 'cash' | 'upi' | 'wallet' | 'employee';

export interface CrmBankAccountDetails {
  bankName?: string;
  accountNumber?: string;
  ifsc?: string;
  branch?: string;
  accountHolder?: string;
}

export interface CrmPaymentAccountDoc {
  _id: string;
  userId?: string;
  accountName: string;
  accountType: CrmPaymentAccountType | string;
  status: CrmPaymentAccountStatus;
  openingBalance: number;
  openingBalanceDate: string;
  currency?: string;
  isDefault?: boolean;
  bankDetails?: CrmBankAccountDetails;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmPaymentAccountListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmPaymentAccountStatus | 'all';
  accountType?: CrmPaymentAccountType | string;
}

export interface CrmPaymentAccountListResponse {
  items: CrmPaymentAccountDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmPaymentAccountCreateInput {
  accountName: string;
  accountType: CrmPaymentAccountType | string;
  openingBalance?: number;
  openingBalanceDate?: string;
  currency?: string;
  isDefault?: boolean;
  bankDetails?: CrmBankAccountDetails;
}

export type CrmPaymentAccountUpdateInput = Partial<CrmPaymentAccountCreateInput> & {
  status?: CrmPaymentAccountStatus;
};

function buildListQuery(p?: CrmPaymentAccountListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.accountType) qs.set('accountType', p.accountType);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmPaymentAccountsApi = {
  list: (params?: CrmPaymentAccountListParams) =>
    rustFetch<CrmPaymentAccountListResponse>(
      `/v1/crm/payment-accounts${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmPaymentAccountDoc>(
      `/v1/crm/payment-accounts/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmPaymentAccountCreateInput) =>
    rustFetch<{ id: string; entity: CrmPaymentAccountDoc }>(
      '/v1/crm/payment-accounts',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: CrmPaymentAccountUpdateInput) =>
    rustFetch<CrmPaymentAccountDoc>(
      `/v1/crm/payment-accounts/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/payment-accounts/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
