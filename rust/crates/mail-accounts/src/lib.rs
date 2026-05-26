//! # mail-accounts
//!
//! Hosted Mail — mailbox account entity. Mongo collection: `mail_accounts`.
//!
//! TODO(integrator):
//!   - Add workspace member in `rust/Cargo.toml`.
//!   - Mount under `/v1/mail/accounts` in `rust/crates/api/src/router.rs`.
//!   - `password_hash` is captured raw today; pre-launch, plumb through the
//!     IMAP/SMTP provider's password-set API instead of storing locally.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
