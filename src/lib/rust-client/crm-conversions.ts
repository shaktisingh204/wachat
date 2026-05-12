import 'server-only';

/**
 * CRM Conversions client — thin convenience wrapper.
 *
 * ## Why this file is thin
 *
 * Unlike sibling CRM modules (`crm-leads`, `crm-quotations`, …) the
 * Rust crate `crm-conversions` is **NOT** an HTTP surface. It is a
 * pure-function transformation library that lives inside the Rust BFF
 * binary (see `rust/crates/crm-conversions/src/lib.rs`). It exposes
 * deterministic helpers like:
 *
 *   - `quotation_to_sales_order(q, so_no, user_id) -> SalesOrder`
 *   - `quotation_to_invoice(q, invoice_no) -> Invoice`
 *   - `quotation_to_proforma(q, proforma_no) -> ProformaInvoice`
 *   - `sales_order_to_delivery_challan(so, challan_no) -> DeliveryChallan`
 *   - `sales_order_to_invoice(so, invoice_no) -> Invoice`
 *   - `invoice_to_credit_note(inv, cn_no, reason) -> CreditNote`
 *   - `purchase_order_to_grn(po, grn_no) -> Grn`
 *   - `purchase_order_to_bill(po, bill_no) -> Bill`
 *   - `grn_to_bill(grn, bill_no, vendor_id, totals) -> Bill`
 *   - `bill_to_debit_note(bill, dn_no, reason) -> DebitNote`
 *
 * These helpers are composed inside the **entity-create** handlers of
 * the child crates. When you create an Invoice with `fromKind:
 * 'quotation'` + `fromId: '...'`, the Rust Invoice handler calls
 * `crm_conversions::quotation_to_invoice` internally to seed the new
 * row, then persists it and stamps the parent's `linkedInvoiceIds[]`.
 *
 * Consequently there is **no `/v1/crm/conversions` HTTP route** to
 * wrap, and no Conversion record entity to CRUD. Conversion is an
 * *action* performed via the existing child-entity-create endpoints.
 *
 * ## What this module exposes
 *
 * Just typed `fromKind` / `fromId` constants and helpers that mirror
 * the Rust signatures. The action layer in `conversions.actions.ts`
 * uses these to call the right child-entity API (e.g.
 * `crmInvoicesApi.create({ ...inv, fromKind: 'quotation', fromId })`).
 *
 * NB: every `rustFetch` call still happens through the child entity
 * client; this file does not call `rustFetch` itself.
 */

/* ─── Conversion catalog ─────────────────────────────────────── */

/**
 * Every supported parent→child transformation in
 * `rust/crates/crm-conversions`. Use this as the source of truth for
 * UI dropdowns ("Convert this quotation to…").
 */
export type CrmConversionKind =
  /* Sales-side. */
  | 'quotationToSalesOrder'
  | 'quotationToInvoice'
  | 'quotationToProforma'
  | 'salesOrderToDeliveryChallan'
  | 'salesOrderToInvoice'
  | 'invoiceToCreditNote'
  /* Purchases-side. */
  | 'purchaseOrderToGrn'
  | 'purchaseOrderToBill'
  | 'grnToBill'
  | 'billToDebitNote';

export interface CrmConversionEdge {
  kind: CrmConversionKind;
  /** Wire value of `fromKind` passed to the child create endpoint. */
  fromKind: string;
  /** Wire value of `toKind` (the child entity that will be created). */
  toKind: string;
  /** Human-readable label for UI surfaces. */
  label: string;
  /** Short description for tooltips and the info page. */
  description: string;
  /**
   * Path to the *child* create page that performs the conversion.
   * Open this with `?fromKind=<fromKind>&fromId=<id>` to prefill.
   */
  createHref: string;
  /** Path to the parent entity list (useful for "where do these live" links). */
  parentHref: string;
}

export const CRM_CONVERSION_CATALOG: readonly CrmConversionEdge[] = [
  {
    kind: 'quotationToSalesOrder',
    fromKind: 'quotation',
    toKind: 'salesOrder',
    label: 'Quotation → Sales Order',
    description:
      'Promote an accepted quote to a sales order. Lineage carries the quotation forward and the SO stamps `quotationRef`.',
    createHref: '/dashboard/crm/sales/orders/new',
    parentHref: '/dashboard/crm/sales-crm/leads',
  },
  {
    kind: 'quotationToInvoice',
    fromKind: 'quotation',
    toKind: 'invoice',
    label: 'Quotation → Invoice',
    description:
      'Skip the SO step (common for service deals). Copies client / currency / items / totals from the quote.',
    createHref: '/dashboard/crm/sales/invoices/new',
    parentHref: '/dashboard/crm/sales-crm/leads',
  },
  {
    kind: 'quotationToProforma',
    fromKind: 'quotation',
    toKind: 'proforma',
    label: 'Quotation → Proforma',
    description:
      'Issue a non-tax proforma invoice from a quotation — typically for advance-payment workflows.',
    createHref: '/dashboard/crm/sales/invoices/new?proforma=1',
    parentHref: '/dashboard/crm/sales-crm/leads',
  },
  {
    kind: 'salesOrderToDeliveryChallan',
    fromKind: 'salesOrder',
    toKind: 'deliveryChallan',
    label: 'Sales Order → Delivery Challan',
    description:
      'Generate a challan for partial or full shipment. Line items copy with their fulfillment counters.',
    createHref: '/dashboard/crm/sales/orders',
    parentHref: '/dashboard/crm/sales/orders',
  },
  {
    kind: 'salesOrderToInvoice',
    fromKind: 'salesOrder',
    toKind: 'invoice',
    label: 'Sales Order → Invoice',
    description:
      'Invoice an SO — fully or in part. The new invoice gets the SO id on its lineage and stamps back into `linkedInvoiceIds[]`.',
    createHref: '/dashboard/crm/sales/invoices/new',
    parentHref: '/dashboard/crm/sales/orders',
  },
  {
    kind: 'invoiceToCreditNote',
    fromKind: 'invoice',
    toKind: 'creditNote',
    label: 'Invoice → Credit Note',
    description:
      'Issue a credit note against an invoice (return / discount / write-off). The CN links back via `linked_invoice_id`.',
    createHref: '/dashboard/crm/sales/credit-notes/new',
    parentHref: '/dashboard/crm/sales/invoices',
  },
  {
    kind: 'purchaseOrderToGrn',
    fromKind: 'purchaseOrder',
    toKind: 'grn',
    label: 'Purchase Order → GRN',
    description:
      'Open a Goods Receipt Note when stock arrives. Item lines carry forward; the GRN stamps `po_id`.',
    createHref: '/dashboard/crm/inventory/grn',
    parentHref: '/dashboard/crm/purchases/orders',
  },
  {
    kind: 'purchaseOrderToBill',
    fromKind: 'purchaseOrder',
    toKind: 'bill',
    label: 'Purchase Order → Bill',
    description:
      'Record a vendor bill directly from a PO (no GRN). Convenient when stock-tracking is not required.',
    createHref: '/dashboard/crm/purchases/expenses',
    parentHref: '/dashboard/crm/purchases/orders',
  },
  {
    kind: 'grnToBill',
    fromKind: 'grn',
    toKind: 'bill',
    label: 'GRN → Bill',
    description:
      'Three-way matched bill — only created from a previously received GRN. The bill links back via `linked_grn_id`.',
    createHref: '/dashboard/crm/purchases/expenses',
    parentHref: '/dashboard/crm/inventory/grn',
  },
  {
    kind: 'billToDebitNote',
    fromKind: 'bill',
    toKind: 'debitNote',
    label: 'Bill → Debit Note',
    description:
      'Issue a debit note against a vendor bill (returns, short-supply, price corrections).',
    createHref: '/dashboard/crm/purchases/debit-notes/new',
    parentHref: '/dashboard/crm/purchases/expenses',
  },
] as const;

/* ─── Lookup helpers ─────────────────────────────────────────── */

/**
 * Find the catalog entry for a given `fromKind` + `toKind` pair, if
 * the conversion is supported. Returns `undefined` for unknown pairs.
 */
export function findConversionEdge(
  fromKind: string,
  toKind: string,
): CrmConversionEdge | undefined {
  return CRM_CONVERSION_CATALOG.find(
    (e) => e.fromKind === fromKind && e.toKind === toKind,
  );
}

/**
 * All conversions whose parent is `fromKind`. Used by an entity's
 * detail page to render its "Convert to…" menu.
 */
export function listConversionsFrom(fromKind: string): readonly CrmConversionEdge[] {
  return CRM_CONVERSION_CATALOG.filter((e) => e.fromKind === fromKind);
}

/**
 * All conversions whose child is `toKind`. Useful when a child-create
 * page wants to advertise "you can come from…" hints.
 */
export function listConversionsTo(toKind: string): readonly CrmConversionEdge[] {
  return CRM_CONVERSION_CATALOG.filter((e) => e.toKind === toKind);
}

/**
 * Build a deep-link to the child-create page that performs a given
 * conversion. The child handlers all accept `fromKind` + `fromId` and
 * call into `crm-conversions` internally.
 */
export function buildConversionHref(edge: CrmConversionEdge, fromId: string): string {
  const sep = edge.createHref.includes('?') ? '&' : '?';
  return `${edge.createHref}${sep}fromKind=${encodeURIComponent(edge.fromKind)}&fromId=${encodeURIComponent(fromId)}`;
}

/**
 * Shape of the `fromKind` + `fromId` payload accepted by every CRM
 * child-create endpoint that supports conversion. Use this as the
 * request-shape for action helpers in `conversions.actions.ts`.
 */
export interface CrmConversionRef {
  fromKind: string;
  fromId: string;
}
