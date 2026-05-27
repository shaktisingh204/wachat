//! # sabops-ad-groups
//!
//! Mirrored AD groups. Upserted by the AD sync worker keyed on
//! `(domainId, name)`. Members are stored as `{ kind, id }` envelopes
//! where `kind ∈ {user, group}` and `id` is the AD object id.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
