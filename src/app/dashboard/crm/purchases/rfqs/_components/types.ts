/**
 * Shared types for the canonical RFQ module client islands.
 *
 * `RfqListRow` is the wire-format the server-side `page.tsx` projects
 * each `CrmRfqDoc` into before handing it to the client tables /
 * bulk-bar / KPI strip. Keeping it ID-stringified (no ObjectId on the
 * wire) keeps the client components serialization-safe.
 *
 * Per `docs/ecosystem/CRM_REBUILD_PLAN.md` §1D — purchase-side mirror
 * of the canonical Quotations module.
 */

export interface RfqListRow {
  _id: string;
  /** Title field — RFQ docs use `title` as their human label/number. */
  title: string;
  /** Optional reference number / scope tag — derived if surfaced later. */
  scope?: string;
  vendorsInvitedCount: number;
  /** ISO date string. */
  deadline?: string;
  /** ISO date string. */
  requiredBy?: string;
  currency?: string;
  /** Optional estimated value (carried in `customFields._estimatedValue`). */
  estimatedValue?: number;
  status: string;
  ownerId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  /** Convenience flag — `deadline` is in the past. */
  deadlinePassed: boolean;
}

export interface RfqKpiSummary {
  draft: number;
  open: number;
  closed: number;
  awarded: number;
  cancelled: number;
}
