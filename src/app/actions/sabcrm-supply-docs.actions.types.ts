/**
 * SabCRM Supply — doc-surface action input/output types + status vocab.
 *
 * Lives beside `sabcrm-supply-docs.actions.ts` because `'use server'`
 * modules may only export async functions; shared types and constants
 * go here (mirrors the `sabcrm-finance-invoices.actions.types.ts`
 * convention, incl. its `SABCRM_INVOICE_TRANSITIONS` record).
 *
 * STATUS VOCAB IS AUTHORITATIVE CLIENT-SIDE (supply-commerce rollout
 * spec §3): the Identity-style crates (purchase-orders, grn, rfqs,
 * vendor-bids) validate against their own `ALLOWED_STATUSES` consts —
 * the unions below mirror those exactly — while the crm-common crates
 * (stock-adjustments, bom, production-orders, warehouses) store
 * free-form `Option<String>`, so these constants are the ONLY guard.
 * Surfaces must never write a status outside this vocabulary.
 */

/* ─── Purchase orders (`crm-purchase-orders`, crate-validated) ──── */

/** Mirrors `crm-purchase-orders/src/dto.rs::ALLOWED_STATUSES` (8). */
export type SabcrmPoStatus =
  | 'draft'
  | 'awaiting_approval'
  | 'approved'
  | 'sent'
  | 'partial'
  | 'received'
  | 'closed'
  | 'cancelled';

/** Happy-path flow for `StatusFlow` (exceptions live off-path). */
export const SABCRM_PO_FLOW: readonly SabcrmPoStatus[] = [
  'draft',
  'awaiting_approval',
  'approved',
  'sent',
  'received',
  'closed',
];

/** Allowed `from → to[]` transitions (spec WI-5). */
export const SABCRM_PO_TRANSITIONS: Record<SabcrmPoStatus, SabcrmPoStatus[]> = {
  draft: ['awaiting_approval', 'approved', 'sent', 'cancelled'],
  awaiting_approval: ['approved', 'draft', 'cancelled'],
  approved: ['sent', 'cancelled'],
  sent: ['partial', 'received', 'cancelled'],
  partial: ['received', 'closed', 'cancelled'],
  received: ['closed'],
  closed: [],
  cancelled: ['draft'],
};

/* ─── GRNs (`crm-grns`, crate-validated) ─────────────────────────── */

/** Mirrors `crm-grns/src/dto.rs::ALLOWED_STATUSES` (8). */
export type SabcrmGrnStatus =
  | 'draft'
  | 'received'
  | 'partial'
  | 'inspected'
  | 'qc_failed'
  | 'posted'
  | 'closed'
  | 'rejected';

export const SABCRM_GRN_FLOW: readonly SabcrmGrnStatus[] = [
  'draft',
  'received',
  'inspected',
  'posted',
  'closed',
];

/** Allowed `from → to[]` transitions (spec WI-6). */
export const SABCRM_GRN_TRANSITIONS: Record<
  SabcrmGrnStatus,
  SabcrmGrnStatus[]
> = {
  draft: ['received', 'partial', 'rejected'],
  received: ['partial', 'inspected', 'rejected'],
  partial: ['received', 'inspected', 'rejected'],
  inspected: ['posted', 'qc_failed'],
  qc_failed: ['inspected', 'rejected'],
  posted: ['closed'],
  closed: [],
  rejected: [],
};

/* ─── RFQs (`crm-rfqs`, validated via `ALLOWED_RFQ_STATUSES`) ────── */

/** Mirrors `crm-vendor-bids/src/dto.rs::ALLOWED_RFQ_STATUSES` (5). */
export type SabcrmRfqStatus =
  | 'draft'
  | 'open'
  | 'closed'
  | 'awarded'
  | 'cancelled';

export const SABCRM_RFQ_FLOW: readonly SabcrmRfqStatus[] = [
  'draft',
  'open',
  'awarded',
  'closed',
];

/** Allowed `from → to[]` transitions (spec WI-8). */
export const SABCRM_RFQ_TRANSITIONS: Record<
  SabcrmRfqStatus,
  SabcrmRfqStatus[]
> = {
  draft: ['open', 'cancelled'],
  open: ['awarded', 'closed', 'cancelled'],
  awarded: ['closed'],
  closed: [],
  cancelled: ['draft'],
};

/* ─── Vendor bids (`crm-vendor-bids`, crate-validated) ───────────── */

/** Mirrors `crm-vendor-bids/src/dto.rs::ALLOWED_STATUSES` (5). */
export type SabcrmVendorBidStatus =
  | 'submitted'
  | 'shortlisted'
  | 'awarded'
  | 'rejected'
  | 'withdrawn';

export const SABCRM_VENDOR_BID_FLOW: readonly SabcrmVendorBidStatus[] = [
  'submitted',
  'shortlisted',
  'awarded',
];

/** Allowed `from → to[]` transitions (spec WI-9). */
export const SABCRM_VENDOR_BID_TRANSITIONS: Record<
  SabcrmVendorBidStatus,
  SabcrmVendorBidStatus[]
> = {
  submitted: ['shortlisted', 'awarded', 'rejected', 'withdrawn'],
  shortlisted: ['awarded', 'rejected', 'withdrawn'],
  awarded: [],
  rejected: [],
  withdrawn: [],
};

/* ─── Stock adjustments (`crm-stock-adjustments`, FREE-FORM) ─────── */

/**
 * UI vocabulary (spec WI-4) — the crate stores `Option<String>` and
 * validates nothing; this union is the only guard.
 */
export type SabcrmStockAdjustmentStatus = 'draft' | 'approved' | 'cancelled';

export const SABCRM_STOCK_ADJUSTMENT_FLOW: readonly SabcrmStockAdjustmentStatus[] =
  ['draft', 'approved'];

export const SABCRM_STOCK_ADJUSTMENT_TRANSITIONS: Record<
  SabcrmStockAdjustmentStatus,
  SabcrmStockAdjustmentStatus[]
> = {
  draft: ['approved', 'cancelled'],
  approved: [],
  cancelled: ['draft'],
};

/* ─── BOMs (`crm-bom`, FREE-FORM) ────────────────────────────────── */

/** UI vocabulary (spec WI-10) — free-form crate, UI-guarded. */
export type SabcrmBomStatus = 'draft' | 'active' | 'obsolete';

export const SABCRM_BOM_FLOW: readonly SabcrmBomStatus[] = ['draft', 'active'];

export const SABCRM_BOM_TRANSITIONS: Record<
  SabcrmBomStatus,
  SabcrmBomStatus[]
> = {
  draft: ['active'],
  active: ['obsolete'],
  obsolete: ['active'],
};

/* ─── Production orders (`crm-production-orders`, FREE-FORM) ─────── */

/** UI vocabulary (spec WI-11, mirrors extras `ProductionStatus`). */
export type SabcrmProductionOrderStatus =
  | 'planned'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export const SABCRM_PRODUCTION_ORDER_FLOW: readonly SabcrmProductionOrderStatus[] =
  ['planned', 'in_progress', 'completed'];

export const SABCRM_PRODUCTION_ORDER_TRANSITIONS: Record<
  SabcrmProductionOrderStatus,
  SabcrmProductionOrderStatus[]
> = {
  planned: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: ['planned'],
};

/* ─── Warehouses (`crm-warehouses`, FREE-FORM master data) ───────── */

/** UI vocabulary (spec WI-3). */
export type SabcrmWarehouseStatus = 'active' | 'inactive' | 'archived';

/* ─── Number suggestion ──────────────────────────────────────────── */

/** Entities `suggestNextSupplyNumber` can mint a number for. */
export type SabcrmSupplyNumberKind =
  | 'purchase-order'
  | 'grn'
  | 'stock-adjustment'
  | 'bom'
  | 'production-order';

/* ─── Transition extras ──────────────────────────────────────────── */

/** Extra patch fields the stock-adjustment approval can carry. */
export interface SabcrmStockAdjustmentTransitionExtras {
  approvalNotes?: string;
}

/**
 * Extra patch fields the production-order completion dialog carries
 * (spec WI-11 — the "complete" variant also PATCHes yield + scrap).
 */
export interface SabcrmProductionOrderTransitionExtras {
  actualYield?: number;
  scrap?: number;
}
