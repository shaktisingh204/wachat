//! # wachat-webhook-conversations
//!
//! Phase 2 slice 9 of the wachat → Rust port: maintain a `conversations`
//! materialized view in MongoDB on the back of inbound message and outbound
//! status webhook events.
//!
//! ## Why a materialized view?
//!
//! The TypeScript implementation does **not** have a `conversations`
//! collection. Instead, `getConversation` in
//! `src/app/actions/whatsapp.actions.ts` (line ~626) loads both
//! `incoming_messages` and `outgoing_messages` for a contact on every
//! request, sorts in memory, and returns the merged list:
//!
//! ```text
//! const [incoming, outgoing] = await Promise.all([
//!     db.collection('incoming_messages').find({ contactId, projectId }).sort({ messageTimestamp: 1 }).toArray(),
//!     db.collection('outgoing_messages').find({ contactId, projectId }).sort({ messageTimestamp: 1 }).toArray(),
//! ]);
//! ```
//!
//! The unread-count + last-message-text view that the inbox list renders is
//! likewise smeared across `contacts` (with `lastMessage`, `lastMessageTimestamp`,
//! `unreadCount` fields written ad-hoc by every send and inbound path — see
//! `webhook-processor.ts` lines 152, 211, 260, 389, 446, 1480-1484, 1856-1865)
//! rather than living on a single conversation document.
//!
//! That works at small scale but pays the read cost on every dashboard tick
//! and makes "show me the 50 most-recently-active conversations" an O(n)
//! scan over `contacts`. The Rust port introduces a true `conversations`
//! collection as the canonical source of these rollups so the inbox query
//! becomes `find().sort({lastMessageAt: -1}).limit(50)` — index-friendly.
//!
//! ## TODO (TS side)
//!
//! Once this crate is producing rows in production, the TS-side
//! `getConversation` and `markConversationAsRead` should be migrated to
//! read/write the `conversations` collection instead of recomputing from
//! `contacts.lastMessage*` and `contacts.unreadCount`. Until then, the
//! materialized view is **additive** — the TS contact-level fields keep
//! working untouched, and Rust readers (the new inbox API) read from
//! `conversations`.
//!
//! ## Public API
//!
//! ```ignore
//! use wachat_webhook_conversations::{ConversationTracker, TrackerOutcome};
//!
//! let tracker = ConversationTracker::new(mongo);
//! // Inbound: bumps lastMessageAt, sets lastMessageText, increments unreadCount.
//! let out: TrackerOutcome = tracker.on_inbound(&project, &change_value).await?;
//! // Status: updates lastDeliveredAt / lastReadAt on the conversation;
//! //         does NOT touch unreadCount (that is inbound-only).
//! let out: TrackerOutcome = tracker.on_status(&project, &change_value).await?;
//! // Frontend hook: reset unread count when an agent opens the chat.
//! tracker.mark_read(&project, &contact_id).await?;
//! ```
//!
//! ## Ordering contract with the rest of the dispatcher
//!
//! `on_inbound` must run **after** the contacts agent has upserted the
//! `WaContact` row for the sender — this crate looks up the contact by
//! `{ projectId, waId: msg.from }` and silently skips messages whose
//! contact does not yet exist (logged at `warn`). The
//! `wachat-webhook-contacts` slice is responsible for ensuring the contact
//! row is in place before the dispatcher invokes us.

pub mod error;
pub mod tracker;

pub use tracker::{ConversationTracker, TrackerOutcome};
