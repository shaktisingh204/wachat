//! # sabcheckout-api-keys
//!
//! HTTP surface for SabCheckout subscription SabcheckoutApiKeys. A SabcheckoutApiKey describes a
//! recurring billing template (interval, amount, optional trial / setup
//! fee). Pages reference api_keys via item entries of type `"api_key"`.
//!
//! Backs the `sabcheckout_api_keys` Mongo collection. Mounted under
//! `/v1/sabcheckout/api_keys`. Tenant-scoped by `userId`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
