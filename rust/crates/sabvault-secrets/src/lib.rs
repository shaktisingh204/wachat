//! # sabvault-secrets
//!
//! HTTP surface for the SabVault Secret entity — opaque encrypted-payload
//! storage for a team password manager. Client-side AES-GCM ciphertext is
//! stored as `encryptedPayloadB64`; the server never sees plaintext.
//!
//! Mounted under `/v1/sabvault/secrets` (see [`router::router`]).
//!
//! ## Mongo collection
//! `sabvault_secrets` — owned by `userId`. Read access also granted via
//! `sharedWithUserIds`; mutation requires ownership.
//!
//! ## Audit
//! Every mutation writes to `crm_audit_log` via `crm_common::audit`.
//! The audit row contains the secret's **metadata only** — ciphertext is
//! stripped before logging.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
