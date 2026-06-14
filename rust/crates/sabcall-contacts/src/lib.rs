//! # sabcall-contacts
//!
//! HTTP surface for the Voice Contact (address-book) entity.
//! A contact is a callable person or organisation — name, E.164 phone,
//! optional email/company, free-form tags, a VIP flag, notes and a simple
//! `active`/`archived` lifecycle status.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
