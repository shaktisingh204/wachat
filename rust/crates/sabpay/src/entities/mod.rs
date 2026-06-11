//! Per-entity modules for the SabPay surface. Each module owns its DTOs,
//! `doc_to_*` mapper, `{userId, mode}`-scoped store fns, and Axum handlers;
//! routes are wired centrally in `crate::lib`'s `router()`.
//!
//! `orders` is the reference template — new entities mirror its structure.

pub mod orders;
pub mod customers;
pub mod refunds;
pub mod payment_links;
pub mod payment_pages;
pub mod plans;
pub mod subscriptions;
pub mod invoices;
pub mod qr_codes;
pub mod settlements;
pub mod disputes;
