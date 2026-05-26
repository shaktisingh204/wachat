//! # mail-contacts-sync
//!
//! Hosted Mail — webmail address book. Mongo: `mail_contacts_sync`.
//!
//! TODO(integrator): workspace member + mount `/v1/mail/contacts-sync`.
//! TODO(IMAP/SMTP): the ingest worker should upsert here on every
//! send/receive event, bumping `lastUsedAt`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
