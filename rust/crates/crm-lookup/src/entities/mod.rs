//! Per-entity lookup specs for the canonical 8 entities. Add a new
//! entity by writing a sibling module + wiring it into
//! [`crate::search::dispatch`].

pub mod account;
pub mod bank_account;
pub mod client;
pub mod employee;
pub mod item;
pub mod user;
pub mod vendor;
pub mod warehouse;
