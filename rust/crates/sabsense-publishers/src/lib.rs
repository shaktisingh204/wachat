//! # sabsense-publishers
//!
//! HTTP surface for SabCheckout subscription SabsensePublishers. A SabsensePublisher describes a
//! recurring billing template (interval, amount, optional trial / setup
//! fee). Pages reference publishers via item entries of type `"publisher"`.
//!
//! Backs the `sabsense_publishers` Mongo collection. Mounted under
//! `/v1/sabcheckout/publishers`. Tenant-scoped by `userId`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
