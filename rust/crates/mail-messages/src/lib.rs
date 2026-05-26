//! # mail-messages
//!
//! Hosted Mail — message metadata + body refs. Mongo collection: `mail_messages`.
//!
//! Raw `.eml` bodies are stored in SabFiles; this crate keeps only the
//! `bodyFileId` reference plus the metadata needed for listing/searching.
//!
//! TODO(integrator): workspace member + mount `/v1/mail/messages`.
//! TODO(IMAP/SMTP): the actual inbound ingest worker (POP3/IMAP poller
//! or LMTP receiver) writes here. Send path goes through `IMailTransport`
//! (TS-side abstraction in `src/lib/mailbox/imail-transport.ts`).

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
