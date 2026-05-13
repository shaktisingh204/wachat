//! # crm-contacts
//!
//! HTTP surface for the Contact entity (`docs/ecosystem/CRM_PLAN.md` §6.3).
//! Reads/writes the existing TS `CrmContact` shape against the `crm_contacts`
//! Mongo collection.
//!
//! Mirrors `src/app/actions/crm.actions.ts` (the contact-related exports —
//! `getCrmContacts`, `getCrmContactById`, `addCrmContact`, `deleteCrmContact`).
//! Once this crate is mounted, those TS server actions become thin proxies
//! via `src/lib/rust-client/crm-contacts.ts`.
//!
//! ## Soft delete
//! `DELETE /v1/crm/contacts/:id` sets `status: "archived"` rather than removing
//! the row — keeps lineage references intact. The legacy TS `deleteCrmContact`
//! does a hard delete; the Rust path is the more conservative choice and the
//! TS adapter maps it transparently.
//!
//! ## Schema note
//! The canonical §1.1 Rust DTO lives in `crm-sales-types::Contact` with the
//! full identity/audit/lifecycle fragment composition. This crate intentionally
//! targets the **legacy** TS shape so the existing UI keeps working unchanged.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
