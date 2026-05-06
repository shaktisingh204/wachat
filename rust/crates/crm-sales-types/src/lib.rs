//! # crm-sales-types
//!
//! Domain DTOs for the CRM Sales module (`crm_function_plan.md` §1).
//! Each entity flattens the cross-cutting fragments from `crm-core` (§0)
//! and adds its own entity-specific fields.
//!
//! ## Scope
//!
//! Sales-only. Purchases / inventory / accounting / sales-CRM (leads,
//! deals, tasks) live in their own crates. Adding a §1 entity here is
//! the right home; adding anything else is a layering violation.
//!
//! ## Modules
//! - [`client`] — §1.1 Clients & Prospects
//!
//! Subsequent runs will add `quotation`, `proforma`, `sales_order`,
//! `delivery_challan`, `invoice`, `payment_receipt`, `credit_note`.
//!
//! ## Conventions
//!
//! - All structs derive `Serialize + Deserialize` with
//!   `rename_all = "camelCase"` so they round-trip with TS document
//!   shapes in `src/lib/definitions.ts`.
//! - Money fields are `f64` to match the TS `Number` JSON shape; a
//!   future migration to `rust_decimal` can happen once the wider port
//!   stabilizes.
//! - Identity / audit / lifecycle / assignment / attribution / tags /
//!   notes / attachments / custom-fields are NEVER redefined here —
//!   always flatten the corresponding `crm-core` struct.

pub mod client;

pub use client::{
    Address, Client, ClientType, ContactBook, ContactChannel, OpeningBalance, TaxPreference,
};
