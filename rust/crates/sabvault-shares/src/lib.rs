//! # sabvault-shares
//!
//! HTTP surface for SabCheckout subscription SabvaultShares. A SabvaultShare describes a
//! recurring billing template (interval, amount, optional trial / setup
//! fee). Pages reference shares via item entries of type `"share"`.
//!
//! Backs the `sabvault_shares` Mongo collection. Mounted under
//! `/v1/sabcheckout/shares`. Tenant-scoped by `userId`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
