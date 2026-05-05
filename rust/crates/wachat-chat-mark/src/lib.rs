//! # wachat-chat-mark
//!
//! Phase 4 slice 7 of the wachat → Rust port: mark a conversation read or
//! unread from the agent inbox.
//!
//! ## TS source of truth
//!
//! `src/app/actions/whatsapp.actions.ts`:
//! - `markConversationAsRead(contactId)` (line ~672) — sets
//!   `contacts.unreadCount = 0` and bulk-updates every unread inbound
//!   message for that contact: `incoming_messages.isRead = true`.
//! - `markConversationAsUnread(contactId)` (line ~697) — sets
//!   `contacts.unreadCount = 1`. Notably the TS does **not** touch
//!   `incoming_messages.isRead` on unread (the unread badge is driven
//!   purely by `contacts.unreadCount`).
//!
//! ## Reconciliation with Phase 2
//!
//! Phase 2 introduced a new `conversations` materialized view (see
//! `wachat-webhook-conversations`) which carries its own `unreadCount`
//! field. While the TS keeps the legacy `contacts.unreadCount` going,
//! we have two concurrent sources of truth, and any new write path
//! MUST keep both consistent or the inbox UI flickers between them.
//!
//! This crate therefore writes to **both** locations on every call:
//!
//! - `mark_read`:
//!   1. `incoming_messages` — `update_many({contactId, isRead:false}, {$set:{isRead:true}})` (TS parity)
//!   2. `contacts` — `update_one({_id: contactId}, {$set:{unreadCount:0}})` (TS parity)
//!   3. `conversations` — `update_one({contactId}, {$set:{unreadCount:0, updatedAt:now}})` (Phase 2 view)
//!
//! - `mark_unread`:
//!   1. `contacts` — `update_one({_id: contactId}, {$set:{unreadCount:1}})` (TS parity)
//!   2. `conversations` — `update_one({contactId}, {$set:{unreadCount:1, updatedAt:now}})` (Phase 2 view)
//!
//!   We deliberately do NOT mutate `incoming_messages.isRead` on
//!   `mark_unread`. The TS doesn't, and flipping a single message back to
//!   unread would split the per-message read state from the conversation
//!   summary in a way no reader currently expects.
//!
//! ## Project scoping
//!
//! Per the slice spec the public API takes only a `contact_id` (matching
//! the TS Server Action signature, which resolves the project from the
//! session before calling). Callers that lack a session (e.g. the API
//! crate handling an authenticated request) are expected to verify the
//! contact's `projectId` against the requester's project list **before**
//! invoking this crate. The crate itself is project-agnostic: it scopes
//! every write by `contactId` only, exactly as the TS does once it has
//! resolved the contact.
//!
//! ## Public API
//!
//! ```ignore
//! use wachat_chat_mark::{ChatMarker, MarkOutcome};
//! use bson::oid::ObjectId;
//!
//! let marker = ChatMarker::new(mongo);
//! let out: MarkOutcome = marker.mark_read(&contact_id).await?;
//! let out: MarkOutcome = marker.mark_unread(&contact_id).await?;
//! ```

pub mod marker;

pub use marker::{ChatMarker, MarkOutcome};
