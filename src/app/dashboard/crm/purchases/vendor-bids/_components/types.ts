/**
 * Shared types for the canonical Vendor Bids module client islands.
 *
 * `VendorBidListRow` is the wire-format the server-side `page.tsx`
 * projects each `CrmVendorBidDoc` into before handing it to the client
 * tables / bulk-bar / KPI strip.
 *
 * Per `docs/ecosystem/CRM_REBUILD_PLAN.md` §1D — purchase-side mirror
 * of the canonical Quotations module (thin spec — see scope-cap note).
 */

export interface VendorBidListRow {
  _id: string;
  /** Synthetic bid number — uses _id tail when the DTO doesn't carry one. */
  bidNo: string;
  vendorId: string;
  vendorName?: string;
  rfqId?: string;
  submittedAt?: string;
  currency?: string;
  total?: number;
  budget?: number;
  leadTimeDays?: number;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface VendorBidKpiSummary {
  draft: number;
  submitted: number;
  shortlisted: number;
  awarded: number;
  rejected: number;
}
