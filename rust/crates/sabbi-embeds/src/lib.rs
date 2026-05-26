//! # sabbi-embeds
//!
//! Public embed tokens for SabBI workbooks. Each embed pins a workbook id, a
//! random token, optional expiry, and an origin allowlist. The public
//! render route at `/embed/sabbi/<token>` resolves via this crate.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
pub use router::public_router;
