import 'server-only';

/**
 * CRM Proforma Invoice client — wraps `/v1/crm/proforma-invoices`.
 */
import { rustFetch } from './fetcher';

export type CrmProformaStatus =
  | 'Draft'
  | 'Issued'
  | 'Converted'
  | 'Cancelled'
  | 'archived';

export interface CrmProformaLineItem {
  itemId?: string;
  description: string;
  quantity: number;
  rate: number;
  unit?: string;
  taxPct?: number;
  amount?: number;
}

export interface CrmProformaInvoiceDoc {
  _id: string;
  userId?: string;
  /** SabCRM workspace scope; absent on legacy (userId-scoped) docs. */
  projectId?: string;
  proformaNumber: string;
  accountId?: string;
  proformaDate: string;
  validTillDate?: string;
  currency?: string;
  /* ----- canonical advance fields (finance-rollout gap G3) ------ */
  /** Linked Sales Order — set when the proforma is an advance request. */
  linkedSoId?: string;
  /** Advance %, 0–100. */
  advancePct?: number;
  /** Absolute advance ask (derived from `advancePct` when absent). */
  advanceAmount?: number;
  paymentDueDate?: string;
  expectedDelivery?: string;
  lineItems: CrmProformaLineItem[];
  subtotal: number;
  total: number;
  taxTotal?: number;
  discountTotal?: number;
  termsAndConditions?: string[];
  notes?: string;
  status?: CrmProformaStatus;
  designMetadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmProformaListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmProformaStatus | 'all';
  accountId?: string;
}

export interface CrmProformaListResponse {
  items: CrmProformaInvoiceDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmProformaCreateInput {
  proformaNumber: string;
  accountId?: string;
  proformaDate: string;
  validTillDate?: string;
  currency?: string;
  /* ----- canonical advance fields (finance-rollout gap G3) ------ */
  /** Hex `ObjectId` of the linked Sales Order. */
  linkedSoId?: string;
  /** Advance %, finite, 0–100. Without `advanceAmount` the handler
   * derives `advanceAmount = total × advancePct / 100`. */
  advancePct?: number;
  advanceAmount?: number;
  /** RFC3339 date string. */
  paymentDueDate?: string;
  /** RFC3339 date string. */
  expectedDelivery?: string;
  lineItems: CrmProformaLineItem[];
  termsAndConditions?: string[];
  notes?: string;
  taxTotal?: number;
  discountTotal?: number;
  designMetadata?: Record<string, unknown>;
}

export type CrmProformaUpdateInput = Partial<CrmProformaCreateInput> & {
  status?: CrmProformaStatus;
  designMetadata?: Record<string, unknown>;
};

function buildListQuery(p?: CrmProformaListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.accountId) qs.set('accountId', p.accountId);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmProformaInvoicesApi = {
  list: (params?: CrmProformaListParams) =>
    rustFetch<CrmProformaListResponse>(
      `/v1/crm/proforma-invoices${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmProformaInvoiceDoc>(
      `/v1/crm/proforma-invoices/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmProformaCreateInput) =>
    rustFetch<{ id: string; entity: CrmProformaInvoiceDoc }>(
      '/v1/crm/proforma-invoices',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: CrmProformaUpdateInput) =>
    rustFetch<CrmProformaInvoiceDoc>(
      `/v1/crm/proforma-invoices/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/proforma-invoices/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
