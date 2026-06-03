//! # sabcheckout-settings
//!
//! HTTP surface for SabCheckout subscription SabcheckoutSettingss. A SabcheckoutSettings describes a
//! recurring billing template (interval, amount, optional trial / setup
//! fee). Pages reference settingss via item entries of type `"settings"`.
//!
//! Backs the `sabcheckout_settings` Mongo collection. Mounted under
//! `/v1/sabcheckout/settingss`. Tenant-scoped by `userId`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
