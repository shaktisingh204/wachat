//! # sabsense-native-ads
//!
//! HTTP surface for SabSense NativeAds.
//! Backs the `sabsense_native_ads` Mongo collection. Mounted under
//! `/v1/sabsense/native_ads`. Tenant-scoped by `userId`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
