/**
 * SabCRM Finance — proforma-invoice-surface action types.
 *
 * Shared between `sabcrm-finance-proforma.actions.ts` ('use server'
 * modules may only export async functions) and the proforma clients.
 *
 * ⚠️ The project mount serves the LEGACY `crm-proforma-invoices` shape
 * (collection `crm_proforma_invoices`): TitleCase statuses, `lineItems`
 * with `quantity`/`taxPct`/`amount`, gross `subtotal` + `taxTotal` /
 * `discountTotal` rollups, crm-common 0-indexed pagination — NOT the
 * canonical `crm_sales_types::ProformaInvoice` (spec §3.3 + gap G3).
 */

import type { CrmProformaStatus } from '@/lib/rust-client/crm-proforma-invoices';
import type {
  DocLineInput,
} from '@/lib/sabcrm/finance-doc-math';
import type { SabcrmPartyObjectSlug } from './sabcrm-finance-invoices.actions.types';

/* ─── Status workflow ─────────────────────────────────────────── */

/**
 * Allowed manual transitions per current status (`Converted` is set by
 * the convert action; `archived` is the crm-common soft-delete state).
 */
export const SABCRM_PROFORMA_TRANSITIONS: Record<
  CrmProformaStatus,
  CrmProformaStatus[]
> = {
  Draft: ['Issued', 'Cancelled'],
  Issued: ['Cancelled'],
  Converted: [],
  Cancelled: ['Draft'],
  archived: [],
};

/* ─── Create / update (full form payloads) ────────────────────── */

/**
 * The full proforma-form payload. The doc rollups (`taxTotal`,
 * `discountTotal`) are recomputed server-side from `lines` via the
 * shared doc math; the crate derives `subtotal`/`total` itself.
 */
export interface SabcrmProformaFullInput {
  proformaNumber: string;
  /** REAL picked party (records-engine record id). Required. */
  accountId: string;
  currency: string;
  /** `YYYY-MM-DD`. */
  proformaDate: string;
  /** `YYYY-MM-DD` — the kit's due-date slot ("Valid till"). */
  validTillDate: string;
  lines: DocLineInput[];
  /** Textarea content — split on newlines into the wire `string[]`. */
  termsAndConditions?: string;
  notes?: string;
  /* ----- advance fields (G3, now live on the mounted shape) ----- */
  /** Linked Sales Order (picked via `searchSabcrmFinanceSalesOrderRefs`). */
  linkedSoId?: string;
  /** Advance %, 0–100. Without `advanceAmount` the crate derives it. */
  advancePct?: number;
  advanceAmount?: number;
  /** `YYYY-MM-DD`. */
  paymentDueDate?: string;
  /** `YYYY-MM-DD`. */
  expectedDelivery?: string;
  /** Save-and-issue ⇒ a follow-up PATCH flips the status to `Issued`
   *  (the legacy create DTO accepts no initial status). */
  issue?: boolean;
}

/** Full-form patch — same shape, everything optional. */
export type SabcrmProformaFullPatch = Partial<
  Omit<SabcrmProformaFullInput, 'issue'>
>;

/* ─── List page / KPIs ────────────────────────────────────────── */

/** Filters the list page sends to the fetcher (1-indexed `page`). */
export interface SabcrmProformaListFilters {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmProformaStatus | '';
  accountId?: string;
  /** Inclusive `YYYY-MM-DD` bounds applied to the proforma date. */
  from?: string;
  to?: string;
}

/** A display-ready list row (party already resolved to a label). */
export interface SabcrmProformaListRow {
  id: string;
  proformaNumber: string;
  partyId: string;
  /** Resolved customer label, or null when the record no longer exists. */
  partyLabel: string | null;
  partyObjectSlug: SabcrmPartyObjectSlug | null;
  proformaDate: string;
  validTillDate: string | null;
  currency: string;
  total: number;
  advanceAmount: number | null;
  status: CrmProformaStatus;
}

export interface SabcrmProformaListPage {
  rows: SabcrmProformaListRow[];
  page: number;
  hasMore: boolean;
}

/** KPI strip numbers (computed over a capped scan; see `sampled`). */
export interface SabcrmProformaKpis {
  /** Dominant currency among scanned proformas (formats the strip). */
  currency: string;
  /** Σ total over Issued proformas (outstanding asks). */
  outstandingValue: number;
  issuedCount: number;
  /** Drafts awaiting issue. */
  draftCount: number;
  /** Proformas converted with activity in the current month. */
  convertedThisMonth: number;
  /** Mean `createdAt → updatedAt` days over currently-Issued proformas —
   *  the closest available proxy for Draft→Issued (the legacy shape has
   *  no per-transition timestamps). Null when nothing is Issued. */
  avgDaysToIssue: number | null;
  /** Proformas scanned. */
  count: number;
  /** True when the scan hit the cap (numbers are a floor, not exact). */
  sampled: boolean;
}

/* ─── Detail ──────────────────────────────────────────────────── */

/** Result payload of the convert action (route target for the toast). */
export interface SabcrmProformaConvertResult {
  id: string;
  number: string;
  href: string;
}
