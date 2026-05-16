import 'server-only';

/**
 * CRM Voucher Entries client — wraps `/v1/crm/voucher-entries`.
 *
 * Individual ledger postings (debits + credits) that hang off a Voucher Book.
 * Each entry MUST balance: sum(debits) === sum(credits) within 0.01 tolerance.
 */
import { rustFetch } from './fetcher';

export type CrmVoucherEntryStatus = 'posted' | 'draft' | 'archived';

export interface CrmVoucherLine {
  accountId: string;
  amount: number;
  description?: string;
}

export interface CrmVoucherEntryDoc {
  _id: string;
  userId?: string;
  voucherBookId: string;
  voucherNumber: string;
  date: string;
  narration?: string;
  debitEntries: CrmVoucherLine[];
  creditEntries: CrmVoucherLine[];
  totalDebit: number;
  totalCredit: number;
  status: CrmVoucherEntryStatus;
  reference?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmVoucherEntryListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmVoucherEntryStatus | 'all';
  voucherBookId?: string;
}

export interface CrmVoucherEntryListResponse {
  items: CrmVoucherEntryDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmVoucherEntryCreateInput {
  voucherBookId: string;
  voucherNumber: string;
  /** RFC3339 date string. */
  date: string;
  narration?: string;
  debitEntries: CrmVoucherLine[];
  creditEntries: CrmVoucherLine[];
  status?: CrmVoucherEntryStatus;
  reference?: string;
}

export type CrmVoucherEntryUpdateInput = Partial<CrmVoucherEntryCreateInput>;

function buildListQuery(p?: CrmVoucherEntryListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.voucherBookId) qs.set('voucherBookId', p.voucherBookId);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmVoucherEntriesApi = {
  list: (params?: CrmVoucherEntryListParams) =>
    rustFetch<CrmVoucherEntryListResponse>(
      `/v1/crm/voucher-entries${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmVoucherEntryDoc>(
      `/v1/crm/voucher-entries/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmVoucherEntryCreateInput) =>
    rustFetch<{ id: string; entity: CrmVoucherEntryDoc }>(
      '/v1/crm/voucher-entries',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: CrmVoucherEntryUpdateInput) =>
    rustFetch<CrmVoucherEntryDoc>(
      `/v1/crm/voucher-entries/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/voucher-entries/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
