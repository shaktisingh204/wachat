import 'server-only';

/**
 * CRM Bill client — wraps `/v1/crm/bills`.
 *
 * Counterpart of the Rust crate `crm-bills`. The Rust handlers return
 * the full `Bill` document on every endpoint; this module narrows the
 * shape into a TS-friendly `CrmBillDoc` and provides camelCase access
 * for the UI layer.
 *
 * The Rust crate calls the entity "bills" (vendor invoices on the
 * buy-side); the user-facing route stays at
 * `/dashboard/crm/purchases/expenses/` for legacy URL stability — bills
 * ARE expenses in the AP sense.
 *
 * NB: `rustFetch` throws on non-2xx — wrap calls in `try/catch` and
 * surface `RustApiError.code` for friendly UI messages.
 */
import { rustFetch } from './fetcher';

/* ─── Wire types — mirror crm_purchases_types::Bill ────────────── */

/** Workflow status. Snake-case on the wire. */
export type CrmBillStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'paid'
  | 'partially_paid'
  | 'overdue'
  | 'cancelled';

/** Recurring cadence. Lowercase on the wire. */
export type CrmBillRecurringFrequency =
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'quarterly'
  | 'yearly';

/** Single line item — mirrors `crm_sales_types::line_item::LineItem`. */
export interface CrmBillLineItem {
  itemId?: string;
  description?: string;
  hsnSac?: string;
  qty: number;
  unit?: string;
  rate: number;
  discountPct?: number;
  taxRatePct?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  cessAmount?: number;
  total: number;
}

/** Direct-to-ledger expense line — for service / utility / rent bills. */
export interface CrmBillExpenseLine {
  accountId?: string;
  description?: string;
  amount: number;
  taxRatePct?: number;
}

/** Document-level totals — mirrors `crm_sales_types::line_item::Totals`. */
export interface CrmBillTotals {
  subTotal: number;
  discountOverall?: number;
  shippingCharge?: number;
  adjustment?: number;
  roundOff?: number;
  total: number;
}

export interface CrmBillRecurringConfig {
  frequency: CrmBillRecurringFrequency;
  endDate?: string;
  nextRun: string;
  remainingRuns?: number;
}

export interface CrmBillDoc {
  _id: string;
  identity?: {
    id?: string;
    projectId?: string;
    userId?: string;
    tenantId?: string;
  };
  audit?: {
    createdAt?: string;
    updatedAt?: string;
    createdBy?: string;
    updatedBy?: string;
  };
  assignment?: {
    assignedTo?: string;
    assignedBy?: string;
    assignedAt?: string;
  };

  billNo?: string;
  vendorInvoiceNo?: string;
  billDate: string;
  dueDate?: string;

  vendorId: string;

  items?: CrmBillLineItem[];
  expenseLines?: CrmBillExpenseLine[];

  tdsSection?: string;
  tdsAmount?: number;
  reverseCharge?: boolean;
  placeOfSupply?: string;

  currency: string;
  exchangeRate?: number;
  totals: CrmBillTotals;

  amountPaid?: number;
  balance?: number;

  recurring?: CrmBillRecurringConfig;
  notes?: string;

  status?: CrmBillStatus;
  linkedPoId?: string;
  linkedGrnIds?: string[];
  lineage?: { kind: string; id: string }[];

  customFields?: Record<string, unknown>;
  tags?: string[];
  archived?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmBillListParams {
  page?: number;
  limit?: number;
  q?: string;
  vendorId?: string;
  status?: CrmBillStatus | string;
}

export interface CrmBillCreateInput {
  projectId?: string;
  billNo?: string;
  vendorInvoiceNo?: string;
  billDate: string;
  dueDate?: string;
  vendorId: string;
  items?: CrmBillLineItem[];
  expenseLines?: CrmBillExpenseLine[];
  tdsSection?: string;
  tdsAmount?: number;
  reverseCharge?: boolean;
  placeOfSupply?: string;
  currency: string;
  exchangeRate?: number;
  totals: CrmBillTotals;
  recurring?: CrmBillRecurringConfig;
  notes?: string;
  /** Optional lineage parent kind. Whitelisted on the Rust side. */
  fromKind?: 'purchaseOrder' | 'grn';
  fromId?: string;
}

export type CrmBillUpdateInput = Partial<
  Omit<CrmBillCreateInput, 'projectId' | 'fromKind' | 'fromId' | 'billNo'>
> & {
  /** Workflow status — only mutable via PATCH. */
  status?: CrmBillStatus | string;
};

/* ─── Client ──────────────────────────────────────────────────── */

function buildListQuery(p?: CrmBillListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.vendorId) qs.set('vendorId', p.vendorId);
  if (p.status) qs.set('status', String(p.status));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmBillsApi = {
  list: (params?: CrmBillListParams) =>
    rustFetch<CrmBillDoc[]>(`/v1/crm/bills${buildListQuery(params)}`),
  getById: (id: string) =>
    rustFetch<CrmBillDoc>(`/v1/crm/bills/${encodeURIComponent(id)}`),
  create: (input: CrmBillCreateInput) =>
    rustFetch<CrmBillDoc>('/v1/crm/bills', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: CrmBillUpdateInput) =>
    rustFetch<CrmBillDoc>(`/v1/crm/bills/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ ok: boolean; deleted?: boolean }>(
      `/v1/crm/bills/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
