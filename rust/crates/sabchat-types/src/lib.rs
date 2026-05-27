//! # sabchat-types
//!
//! Shared **domain DTOs** for the SabChat module — the SabNode omnichannel
//! live-chat / inbox layer that competes with Tawk.io and Chatwoot.
//!
//! These types model the documents stored in MongoDB by the SabChat handler
//! crates (`sabchat-inboxes`, `sabchat-contacts`, `sabchat-conversations`,
//! `sabchat-messages`, `sabchat-audit`, `sabchat-routing`, `sabchat-widget`,
//! `sabchat-ws`).
//!
//! ## Scope
//!
//! SabChat-only. Wachat / CRM / SEO / Telegram shapes live in their own
//! crates. SabChat does ingest from those channels but persists into its own
//! collections under a unified conversation/contact graph.
//!
//! ## Collections
//!
//! | DTO                  | Mongo collection         |
//! |----------------------|--------------------------|
//! | [`SabChatInbox`]     | `sabchat_inboxes`        |
//! | [`SabChatContact`]   | `sabchat_contacts`       |
//! | [`SabChatConversation`] | `sabchat_conversations` |
//! | [`SabChatMessage`]   | `sabchat_messages`       |
//! | [`SabChatAssignment`] | `sabchat_assignments` (history) |
//! | [`SabChatAuditEvent`] | `sabchat_audit_log`     |
//!
//! ## Serde conventions
//!
//! Every struct derives `Serialize + Deserialize` with `rename_all =
//! "camelCase"` to round-trip to the camelCase shape used by the Next.js
//! side. The `id` field is renamed to `_id` (Mongo PK) and uses
//! `bson::oid::ObjectId`. Foreign-key fields (`tenantId`, `inboxId`,
//! `contactId`, `conversationId`, …) are also `ObjectId`. Timestamps use
//! `chrono::DateTime<Utc>` with the `bson::serde_helpers` codec so they
//! round-trip as proper BSON Date types.
//!
//! ## No logic
//!
//! This crate contains **no business logic**, no I/O, no async. Pure types.

pub mod assignment;
pub mod audit;
pub mod contact;
pub mod content;
pub mod conversation;
pub mod inbox;
pub mod message;

pub use assignment::SabChatAssignment;
pub use audit::{AuditAction, SabChatAuditEvent};
pub use contact::{SabChatContact, SocialIdentity};
pub use content::{Attachment, CardButton, CarouselCard, ContentBlock};
pub use conversation::{
    ConversationPriority, ConversationStatus, SabChatConversation, SlaPolicy,
};
pub use inbox::{BusinessHours, ChannelConfig, ChannelType, SabChatInbox};
pub use message::{MessageDirection, SabChatMessage, SenderType};
