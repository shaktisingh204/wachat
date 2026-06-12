/**
 * SabCRM Finance — flagship invoice-surface action types.
 *
 * Shared between `sabcrm-finance-invoices.actions.ts` ('use server'
 * modules may only export async functions) and the doc-surface kit /
 * invoice clients. Mirrors the `sabcrm-finance.actions.types.ts`
 * convention.
 */

import type {
  CrmInvoiceGstTreatment,
  CrmInvoiceStatus,
} from '@/lib/rust-client/crm-invoices';
import type {
  DocLineInput,
  DocTotalsModifiersInput,
} from '@/lib/sabcrm/finance-doc-math';

/* ─── Parties (records-engine companies / people) ─────────────── */

/** Which records-engine objects can be an invoice counterparty. */
export type SabcrmPartyObjectSlug = 'companies' | 'people';

/** One row in the customer picker. */
export interface SabcrmPartyOption {
  /** Record id (24-char hex) — saved as the invoice's `clientId`. */
  id: string;
  /** Human label (company name / person full name). Never an ObjectId. */
  label: string;
  /** Secondary line (email when known, else the object name). */
  meta?: string;
  objectSlug: SabcrmPartyObjectSlug;
}

/** A resolved party reference for display (list rows, detail header). */
export interface SabcrmPartyRef {
  id: string;
  label: string;
  objectSlug: SabcrmPartyObjectSlug;
}

/** Full contact details for the email flow + the detail party card. */
export interface SabcrmPartyContact extends SabcrmPartyRef {
  email: string | null;
  /**
   * Bill-to address lines resolved from the record's ADDRESS field
   * (street / street 2 / "city, state postcode" / country). Empty when
   * the record has no address field or it's blank.
   */
  addressLines?: string[];
}

/* ─── Items (sabcrm-supply catalog) ───────────────────────────── */

/** One row in the line-item picker (trimmed `CrmItemDoc`). */
export interface SabcrmItemOption {
  id: string;
  name: string;
  sku?: string;
  description?: string;
  sellingPrice: number;
  taxRate?: number;
  hsnSac?: string;
  currency?: string;
}

/* ─── Invoice create / update (full form payloads) ────────────── */

/** SabFiles attachment pointer (mirrors `crm_core::Attachment`). */
export interface SabcrmDocAttachmentInput {
  fileId: string;
  name?: string;
  mimeType?: string;
  size?: number;
}

/**
 * The full doc-form payload. Totals are NOT part of the input — the
 * action recomputes them from `lines` via `computeDocTotals` so the
 * client can never save inconsistent money.
 */
export interface SabcrmInvoiceFullInput {
  invoiceNo: string;
  /** REAL picked party (records-engine record id). Required — the
   *  flagship surface never mints placeholder ids. */
  clientId: string;
  currency: string;
  /** `YYYY-MM-DD`. */
  date: string;
  /** `YYYY-MM-DD`. */
  dueDate: string;
  lines: DocLineInput[];
  /**
   * Header totals modifiers (overall discount / shipping / adjustment /
   * round-off flag). Folded into the recomputed wire `totals` via the
   * shared `computeDocGrandTotals` — never trusted from a client total.
   */
  totalsModifiers?: DocTotalsModifiersInput;
  /** Place of supply — free-text state name (legacy convention). */
  placeOfSupply?: string;
  /** GST treatment wire value (validated against the crate vocabulary). */
  gstTreatment?: CrmInvoiceGstTreatment;
  /** TCS %, 0–100. */
  tcsPct?: number;
  /** TDS %, 0–100. */
  tdsPct?: number;
  paymentTerms?: string;
  customerNotes?: string;
  termsAndConditions?: string;
  attachments?: SabcrmDocAttachmentInput[];
  /** Save-and-issue ⇒ the action follows up with a `sent` transition. */
  issue?: boolean;
  /** Optional lineage parent (quotation → invoice etc.). */
  fromKind?: 'quotation' | 'salesOrder' | 'proforma' | 'deal' | 'lead';
  fromId?: string;
}

/** Full-form patch — same shape, everything optional. */
export type SabcrmInvoiceFullPatch = Partial<
  Omit<SabcrmInvoiceFullInput, 'issue' | 'fromKind' | 'fromId'>
>;

/* ─── Status workflow ─────────────────────────────────────────── */

/** Allowed manual transitions per current status (kit + action share it). */
export const SABCRM_INVOICE_TRANSITIONS: Record<
  CrmInvoiceStatus,
  CrmInvoiceStatus[]
> = {
  draft: ['sent', 'cancelled'],
  sent: ['overdue', 'cancelled'],
  partially_paid: ['cancelled'],
  overdue: ['cancelled'],
  paid: [],
  cancelled: ['draft'],
};

/* ─── Payments ────────────────────────────────────────────────── */

/** Payment modes accepted by `crm-payment-receipts`. */
export type SabcrmPaymentMode =
  | 'cash'
  | 'cheque'
  | 'upi'
  | 'neft'
  | 'rtgs'
  | 'imps'
  | 'card'
  | 'wallet';

/** "Record payment" dialog payload. */
export interface SabcrmInvoicePaymentInput {
  /** Amount received. Required, finite, > 0. */
  amount: number;
  /** Receipt date, `YYYY-MM-DD`. */
  date: string;
  mode: SabcrmPaymentMode;
  /** REAL payment-account id — picked, never minted. Required. */
  bankAccountId: string;
  reference?: string;
  notes?: string;
}

/* ─── List page / KPIs / related rail ─────────────────────────── */

/** Filters the list page sends to the fetcher. */
export interface SabcrmInvoiceListFilters {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmInvoiceStatus | '';
  clientId?: string;
  /** Inclusive `YYYY-MM-DD` bounds applied to the invoice date. */
  from?: string;
  to?: string;
}

/** A display-ready list row (party already resolved to a label). */
export interface SabcrmInvoiceListRow {
  id: string;
  invoiceNo: string;
  partyId: string;
  /** Resolved customer label, or null when the record no longer exists. */
  partyLabel: string | null;
  partyObjectSlug: SabcrmPartyObjectSlug | null;
  date: string;
  dueDate: string;
  currency: string;
  total: number;
  amountPaid: number;
  balance: number;
  status: CrmInvoiceStatus;
  /** Days past due (positive ⇒ overdue) for open invoices, else null. */
  agingDays: number | null;
}

export interface SabcrmInvoiceListPage {
  rows: SabcrmInvoiceListRow[];
  page: number;
  hasMore: boolean;
}

/** KPI strip numbers (computed over a capped scan; see `sampled`). */
export interface SabcrmInvoiceKpis {
  /** Dominant currency among scanned invoices (formats the strip). */
  currency: string;
  /** Σ totals.total, excluding cancelled. */
  totalInvoiced: number;
  /** Σ balance over open (non-draft, non-cancelled, unpaid) invoices. */
  outstanding: number;
  /** Open invoices past their due date. */
  overdueCount: number;
  /** Σ totals.total for invoices dated in the current month. */
  thisMonthTotal: number;
  thisMonthCount: number;
  /** Invoices scanned. */
  count: number;
  /** True when the scan hit the cap (numbers are a floor, not exact). */
  sampled: boolean;
}

/** One entry in the detail page's related-documents rail. */
export interface SabcrmRelatedDocRef {
  /** Lineage kind ("quotation", "salesOrder", "proforma", "paymentReceipt", …). */
  kind: string;
  id: string;
  /** Document number when resolvable, else a humanised kind. */
  label: string;
  /** Route to the document's surface, when one exists. */
  href: string | null;
  date?: string;
  amount?: number;
  currency?: string;
  status?: string;
  direction: 'parent' | 'child';
}

/** Payment-account option for the record-payment dialog. */
export interface SabcrmPaymentAccountOption {
  id: string;
  label: string;
}
