//! # sabcheckout-integrations
//!
//! HTTP surface for SabCheckout subscription SabcheckoutIntegrations. A SabcheckoutIntegration describes a
//! recurring billing template (interval, amount, optional trial / setup
//! fee). Pages reference integrations via item entries of type `"integration"`.
//!
//! Backs the `sabcheckout_integrations` Mongo collection. Mounted under
//! `/v1/sabcheckout/integrations`. Tenant-scoped by `userId`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
