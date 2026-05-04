//! `wachat-webhook-inbound` — Phase-2 inbound message processor.
//!
//! ## Scope
//!
//! Persists each entry in `change.value.messages[]` as a document in the
//! `incoming_messages` Mongo collection. The write is idempotent on Meta's
//! `wamid` so a webhook retry from Meta cannot create duplicate rows.
//!
//! ## Out of scope (DO NOT add here)
//!
//! - SabFlow execution (templates, conditions, CRM hooks, auto-replies). The
//!   TS file `src/lib/webhook-processor.ts` carries 2.3k lines of flow
//!   runtime; that is a separate future phase. The receiver crate will call
//!   into a dedicated `wachat-flow-runtime` crate after persistence.
//! - Contact upsert / unread-count maintenance — owned by
//!   `wachat-webhook-contacts`.
//! - Notification fan-out — owned by `wachat-webhook-notifications`.
//!
//! ## Persistence shape
//!
//! Mirrors the TS upsert at `src/lib/webhook-processor.ts:1502`:
//!
//! ```text
//! db.collection('incoming_messages').updateOne(
//!     { wamid: message.id, projectId: project._id },
//!     { $setOnInsert: { direction: 'in', projectId, contactId, wamid,
//!                       messageTimestamp, type, content, isRead: false,
//!                       createdAt } },
//!     { upsert: true },
//! );
//! ```
//!
//! Note: the TS write also stores `contactId`. We don't have the contact
//! resolver in this crate (that's `wachat-webhook-contacts`); for now the
//! field is set to `null` and a follow-up phase will backfill / wire the
//! contact id through the receiver. The `wamid + projectId` unique-ish
//! constraint is what matters for idempotency.

pub mod error;
pub mod mapping;
pub mod processor;

pub use mapping::{extract_media_id, extract_text, message_kind};
pub use processor::{InboundOutcome, InboundProcessor, build_inbound_doc};
