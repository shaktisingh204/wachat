//! # wachat-webhook-contacts
//!
//! Upsert `WaContact` Mongo documents in response to Meta webhook **inbound
//! messages** (the `change.value.messages[]` payload, joined with the
//! sender-profile array `change.value.contacts[]`).
//!
//! **Source of truth**: `src/lib/webhook-processor.ts`. The TS handler does
//! the contact upsert inline alongside message persistence (see
//! `webhook-processor.ts` ~line 1475):
//!
//! ```text
//! const contactResult = await db.collection<Contact>('contacts').findOneAndUpdate(
//!     { waId: senderWaId, projectId: project._id, phoneNumberId: phoneNumberId },
//!     {
//!         $set: {
//!             phoneNumberId: phoneNumberId,
//!             lastMessage: lastMessageText,
//!             lastMessageTimestamp: new Date(parseInt(message.timestamp, 10) * 1000),
//!             ...(hasRealName ? { name: senderName } : {}),
//!         },
//!         $inc: { unreadCount: 1 },
//!         $setOnInsert: {
//!             waId: senderWaId,
//!             projectId: project._id,
//!             ...(!hasRealName ? { name: `User (${senderWaId.slice(-4)})` } : {}),
//!             createdAt: new Date(),
//!             hasReceivedWelcome: false,
//!         },
//!     },
//!     { upsert: true, returnDocument: 'after' }
//! );
//! ```
//!
//! This crate isolates the **identity-refresh** concern — name / phone /
//! last-seen — from the rest of the inbound pipeline (message body
//! persistence, unread-count math, `lastMessage` text rendering, dedup,
//! flow triggering). The full inbound crate (`wachat-webhook-inbound`)
//! composes this slice with the others.
//!
//! Differences from TS — intentional, to keep the slice focused:
//! - **No `phoneNumberId` in the filter.** The slice contract specifies
//!   `{ projectId, waId }` as the upsert key. The TS includes
//!   `phoneNumberId` because a single project can have multiple WABA phone
//!   numbers and the TS treats `(project, phoneNumberId, waId)` as the
//!   conversation key. The contact identity itself is `(project, waId)`,
//!   so for a contact-only refresh we deliberately drop `phoneNumberId`.
//! - **No `lastMessage` text** — that's a side effect of message-body
//!   parsing and lives in the inbound-message slice.
//! - **No `unreadCount` increment** — same reason.
//! - **No `hasReceivedWelcome`/`phoneNumberId` $setOnInsert** — fresh
//!   contacts created by this slice are minimal stubs; the inbound
//!   message slice fills in the rest on the same upsert pass when both
//!   slices are wired together.
//! - We also write a normalized `phone` field (canonical `+CCNNN…`) so
//!   downstream queries that key off `phone` work — best-effort, falls
//!   back to the raw `wa_id` when libphonenumber rejects it.
//!
//! Public API:
//! ```ignore
//! use wachat_webhook_contacts::{ContactsUpserter, UpsertOutcome};
//!
//! let upserter = ContactsUpserter::new(mongo);
//! let outcome: UpsertOutcome = upserter.upsert_from_inbound(&project, &change_value).await?;
//! ```

pub mod error;
pub mod upserter;

pub use error::Result;
pub use upserter::{ContactsUpserter, UpsertOutcome};
