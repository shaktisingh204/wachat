import 'server-only';

/**
 * SabCheckout invoices client — wraps `/v1/sabcheckout/invoices`.
 * Counterpart of `sabcheckout-invoices`.
 */
import { rustFetch } from './fetcher';

export type SabcheckoutInvoiceStatus =
  | 'draft'
  | 'open'
  | 'paid'
  | 'failed'
  | 'void';

export interface SabcheckoutInvoiceDoc {
  _id: string;
  userId: string;
  subscriptionId: string;
  periodStart: string;
  periodEnd: string;
  amountMinor: number;
  currency: string;
  status: SabcheckoutInvoiceStatus;
  paidAt?: string;
  paymentRef?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SabcheckoutInvoiceListParams {
  page?: number;
  limit?: number;
  status?: SabcheckoutInvoiceStatus | 'all';
  subscriptionId?: string;
}

export interface SabcheckoutInvoiceListResponse {
  items: SabcheckoutInvoiceDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface SabcheckoutInvoiceCreateInput {
  subscriptionId: string;
  periodStart: string;
  periodEnd: string;
  amountMinor: number;
  currency?: string;
  status?: SabcheckoutInvoiceStatus;
}

export interface SabcheckoutInvoiceMarkPaidInput {
  paymentRef?: string;
}

function buildListQuery(p?: SabcheckoutInvoiceListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.status) qs.set('status', p.status);
  if (p.subscriptionId) qs.set('subscriptionId', p.subscriptionId);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const sabcheckoutInvoicesApi = {
  list: (params?: SabcheckoutInvoiceListParams) =>
    rustFetch<SabcheckoutInvoiceListResponse>(
      `/v1/sabcheckout/invoices${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<SabcheckoutInvoiceDoc>(
      `/v1/sabcheckout/invoices/${encodeURIComponent(id)}`,
    ),
  create: (input: SabcheckoutInvoiceCreateInput) =>
    rustFetch<{ id: string; entity: SabcheckoutInvoiceDoc }>(
      '/v1/sabcheckout/invoices',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  markPaid: (id: string, input: SabcheckoutInvoiceMarkPaidInput = {}) =>
    rustFetch<SabcheckoutInvoiceDoc>(
      `/v1/sabcheckout/invoices/${encodeURIComponent(id)}/mark-paid`,
      { method: 'POST', body: JSON.stringify(input) },
    ),
};
