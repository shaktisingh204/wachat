import 'server-only';

/**
 * CRM Invoice client — wraps `/v1/crm/invoices`.
 *
 * Counterpart of the Rust crate `crm-invoices`. The Rust handlers return
 * the full `Invoice` document on every endpoint; this module narrows the
 * shape into a TS-friendly `CrmInvoiceDoc` and provides camelCase access
 * for the UI layer.
 *
 * NB: `rustFetch` throws on non-2xx — wrap calls in `try/catch` and
 * surface `RustApiError.code` for friendly UI messages.
 */
import { rustFetch } from './fetcher';

/* ─── Wire types — mirror crm_sales_types::invoice::Invoice ────── */

/** GST treatment for the buyer. Snake-case on the wire. */
export type CrmInvoiceGstTreatment =
  | 'registered'
  | 'composition'
  | 'unregistered'
  | 'overseas'
  | 'sez_with_payment'
  | 'sez_without_payment'
  | 'deemed_export'
  | 'consumer';

/** Workflow status. Snake-case on the wire. */
export type CrmInvoiceStatus =
  | 'draft'
  | 'sent'
  | 'paid'
  | 'partially_paid'
  | 'overdue'
  | 'cancelled';

/** Recurring cadence. Lowercase on the wire. */
export type CrmInvoiceRecurringFrequency =
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'quarterly'
  | 'yearly';

/** Single line item — mirrors `crm_sales_types::line_item::LineItem`. */
export interface CrmInvoiceLineItem {
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
  /* SO-only fulfillment fields — usually omitted on invoices. */
  warehouseId?: string;
  qtyPending?: number;
  qtyDelivered?: number;
  qtyInvoiced?: number;
}

/** Document-level totals — mirrors `crm_sales_types::line_item::Totals`. */
export interface CrmInvoiceTotals {
  subTotal: number;
  discountOverall?: number;
  shippingCharge?: number;
  adjustment?: number;
  roundOff?: number;
  total: number;
}

export interface CrmInvoiceRecurringConfig {
  frequency: CrmInvoiceRecurringFrequency;
  endDate?: string;
  nextRun: string;
  remainingRuns?: number;
}

export interface CrmInvoiceBankDetails {
  bankName?: string;
  accountHolder?: string;
  accountNo?: string;
  ifsc?: string;
  branch?: string;
  swift?: string;
}

export interface CrmInvoiceEInvoiceEnvelope {
  irn: string;
  qrString: string;
  ackNo: string;
  ackDate: string;
}

export interface CrmInvoiceDoc {
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
  attribution?: {
    source?: string;
    medium?: string;
    campaign?: string;
    referrerUrl?: string;
  };
  assignment?: {
    assignedTo?: string;
    assignedBy?: string;
    assignedAt?: string;
  };

  invoiceNo: string;
  date: string;
  dueDate: string;

  clientId: string;
  placeOfSupply?: string;
  reverseCharge?: boolean;
  gstTreatment?: CrmInvoiceGstTreatment;

  currency: string;
  exchangeRate?: number;

  billingAddress?: Record<string, unknown>;
  shippingAddress?: Record<string, unknown>;

  items: CrmInvoiceLineItem[];
  totals: CrmInvoiceTotals;

  tcsPct?: number;
  tdsPct?: number;

  amountPaid?: number;
  balance?: number;
  paymentTerms?: string;

  bankDetails?: CrmInvoiceBankDetails;
  upiId?: string;
  qrImageFileId?: string;

  customerNotes?: string;
  termsAndConditions?: string;

  eInvoice?: CrmInvoiceEInvoiceEnvelope;
  ewayBillNo?: string;

  attachments?: unknown[];
  templateId?: string;
  thumbnailFileId?: string;
  signatureImageFileId?: string;

  recurring?: CrmInvoiceRecurringConfig;
  status?: CrmInvoiceStatus;
  lineage?: { kind: string; id: string }[];

  customFields?: Record<string, unknown>;
  tags?: string[];
  designMetadata?: Record<string, unknown>;
  archived?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmInvoiceListParams {
  page?: number;
  limit?: number;
  q?: string;
  clientId?: string;
  status?: CrmInvoiceStatus | string;
  month?: number;
  year?: number;
}

export interface CrmInvoiceCreateInput {
  projectId?: string;
  invoiceNo: string;
  date: string;
  dueDate: string;
  clientId: string;
  placeOfSupply?: string;
  gstTreatment?: CrmInvoiceGstTreatment;
  currency: string;
  items: CrmInvoiceLineItem[];
  totals: CrmInvoiceTotals;
  tcsPct?: number;
  tdsPct?: number;
  paymentTerms?: string;
  customerNotes?: string;
  termsAndConditions?: string;
  recurring?: CrmInvoiceRecurringConfig;
  /** Optional lineage parent kind. Whitelisted on the Rust side. */
  fromKind?: 'quotation' | 'salesOrder' | 'proforma' | 'deal' | 'lead';
  fromId?: string;
  designMetadata?: Record<string, unknown>;
}

export type CrmInvoiceUpdateInput = Partial<
  Omit<CrmInvoiceCreateInput, 'projectId' | 'fromKind' | 'fromId'>
> & {
  /** Workflow status — only mutable via PATCH. */
  status?: CrmInvoiceStatus | string;
  designMetadata?: Record<string, unknown>;
};

/* ─── Client ──────────────────────────────────────────────────── */

function buildListQuery(p?: CrmInvoiceListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.clientId) qs.set('clientId', p.clientId);
  if (p.status) qs.set('status', String(p.status));
  if (p.month != null) qs.set('month', String(p.month));
  if (p.year != null) qs.set('year', String(p.year));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmInvoicesApi = {
  list: (params?: CrmInvoiceListParams) =>
    rustFetch<CrmInvoiceDoc[]>(`/v1/crm/invoices${buildListQuery(params)}`),
  getById: (id: string) =>
    rustFetch<CrmInvoiceDoc>(`/v1/crm/invoices/${encodeURIComponent(id)}`),
  create: (input: CrmInvoiceCreateInput) =>
    rustFetch<CrmInvoiceDoc>('/v1/crm/invoices', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: CrmInvoiceUpdateInput) =>
    rustFetch<CrmInvoiceDoc>(`/v1/crm/invoices/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ ok: boolean; deleted?: boolean }>(
      `/v1/crm/invoices/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
