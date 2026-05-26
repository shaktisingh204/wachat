//! # mail-domains
//!
//! Hosted Mail — custom-domain entity. Stores per-tenant domains plus the
//! DNS verification state required to send/receive mail through SabNode's
//! managed mailbox stack (MX, DKIM, SPF, DMARC).
//!
//! ## TODO (integrator)
//!   - Wire actual DNS lookup worker that flips
//!     `mxStatus`/`spfStatus`/`dmarcStatus` from `pending` → `verified`.
//!     For now those fields are user-managed / stubbed.
//!   - When the IMAP/SMTP provider lands, derive `dkimSelector` +
//!     `dkimPublicKey` from the provider's key-rotation API.
//!   - Add Cargo workspace member entry in `rust/Cargo.toml`.
//!   - Mount `mail_domains::router::<AppState>()` under `/v1/mail/domains`
//!     in `rust/crates/api/src/router.rs`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
