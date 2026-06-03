//! # sabvault-secrets
//!
//! HTTP surface for SabCheckout subscription SabvaultSecrets. A SabvaultSecret describes a
//! recurring billing template (interval, amount, optional trial / setup
//! fee). Pages reference secrets via item entries of type `"secret"`.
//!
//! Backs the `sabvault_secrets` Mongo collection. Mounted under
//! `/v1/sabcheckout/secrets`. Tenant-scoped by `userId`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
