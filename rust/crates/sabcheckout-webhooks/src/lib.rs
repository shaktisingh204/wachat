//! # sabcheckout-webhooks
//!
//! HTTP surface for SabCheckout subscription SabcheckoutWebhooks. A SabcheckoutWebhook describes a
//! recurring billing template (interval, amount, optional trial / setup
//! fee). Pages reference webhooks via item entries of type `"webhook"`.
//!
//! Backs the `sabcheckout_webhooks` Mongo collection. Mounted under
//! `/v1/sabcheckout/webhooks`. Tenant-scoped by `userId`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
