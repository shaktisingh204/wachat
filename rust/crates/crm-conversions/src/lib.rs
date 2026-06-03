//! # crm-conversions
//!
//! Pure-function conversion helpers that build a child CRM document from
//! a parent and propagate `lineage[]` per §13.5 of `crm_function_plan.md`.
//!
//! ## Scope
//!
//! These helpers are **deterministic transformations only** — no I/O,
//! no Mongo, no async. The eventual server actions will compose these
//! to build the in-memory child doc, then persist it (and stamp the
//! parent's `convertedTo` / `linkedXxxIds` arrays) themselves.
//!
//! ## Conventions
//!
//! Every conversion function:
//! - Takes the parent by `&` reference.
//! - Returns an owned child document with a fresh `Identity._id` and
//!   `Audit::new(None)`. The parent's `projectId`, `userId`, and
//!   `tenantId` are inherited so the child stays in the same ownership
//!   scope. (Callers can re-stamp `created_by` / `updated_by` upstream.)
//! - Calls [`crm_core::build_lineage_from_parent`] with the parent's
//!   `kind` string + `_id` + existing `lineage[]` so the chain grows
//!   forward without losing earlier provenance.
//! - Sets the entity-specific back-link field on the child
//!   (`quotation_ref`, `linked_invoice_id`, `linked_po_id`, `po_id`,
//!   `linked_bill_id`, …).
//!
//! ## Modules
//! - [`sales`] — Sales-side conversions
//!   (Quotation → SO/Invoice/Proforma, SO → Challan/Invoice,
//!   Invoice → CreditNote).
//! - [`purchases`] — Purchases-side conversions
//!   (PO → GRN/Bill, GRN → Bill, Bill → DebitNote).

pub mod purchases;
pub mod sales;

pub use purchases::{
    bill_to_debit_note, grn_to_bill, purchase_order_to_bill, purchase_order_to_grn,
};
pub use sales::{
    invoice_to_credit_note, quotation_to_invoice, quotation_to_proforma, quotation_to_sales_order,
    sales_order_to_delivery_challan, sales_order_to_invoice,
};
