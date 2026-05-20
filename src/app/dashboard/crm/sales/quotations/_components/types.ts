/**
 * Shared types for the canonical Quotations module client islands.
 *
 * `QuotationListRow` is the wire-format the server-side `page.tsx`
 * projects each `CrmQuotationDoc` into before handing it to the client
 * tables / bulk-bar / KPI strip. Keeping it ID-stringified (no
 * ObjectId on the wire) keeps the client components serialization-safe.
 *
 * Per `docs/ecosystem/CRM_REBUILD_PLAN.md` §1D.
 */

export interface QuotationListRow {
  _id: string;
  quotationNo: string;
  subject?: string;
  clientId?: string | null;
  date?: string;
  validUntil?: string;
  currency?: string;
  total?: number;
  status: string;
  salesAgentId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  expired: boolean;
}

export interface QuotationKpiSummary {
  totalOpen: number;
  accepted: number;
  rejected: number;
  expired: number;
  /** `accepted + converted` ÷ total quotations, in percent. */
  conversionRatePct: number | null;
  /** Quotations dated on/after the first of the current month. */
  totalThisMonth: number;
  /** Sum of `totals.total` across the loaded window (in `currency`). */
  totalQuotedValue: number;
  /** Dominant currency for `totalQuotedValue` (best-effort). */
  currency: string;
  /** Drafts only. */
  draft: number;
}
