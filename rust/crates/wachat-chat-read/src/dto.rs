//! Wire-shape DTOs for the chat read endpoints.
//!
//! ## Why these field names exactly
//!
//! These structs are not new domain types. They are the **exact shapes the
//! React client already consumes** — `getInitialChatData` and
//! `getConversation` in `src/app/actions/whatsapp.actions.ts` `JSON.parse(
//! JSON.stringify(...))` raw Mongo documents and ship them straight to the
//! browser. The chat UI reaches into nested fields like
//! `message.content.text.body`, `message.content.interactive.button_reply.title`,
//! and `contact.unreadCount`, so we must serialize:
//!
//! - **camelCase** field names (`messageTimestamp`, `lastMessageAt`,
//!   `unreadCount`, `phoneNumberId`, …),
//! - **`_id`** for the Mongo primary key (not `id`),
//! - **`content` as opaque `serde_json::Value`** so every per-type subtree the
//!   message renderer pokes at (`text.body`, `interactive.button_reply`,
//!   `payment_request.amount`, etc.) survives untouched, and
//! - **all timestamps as ISO-8601 strings** via `chrono::DateTime<Utc>` (the
//!   browser does `new Date(message.messageTimestamp)`).
//!
//! ## Why not reuse `wachat_types::MessageLog` / `WaContact`?
//!
//! `MessageLog` is the Rust-port's *future* unified shape (one row per
//! message keyed by `Direction`, with `contact_phone` denormalised, no
//! `content` field). The current TS UI doesn't see that shape — it sees the
//! raw `incoming_messages` / `outgoing_messages` documents. Until the
//! frontend is migrated, the chat read API has to keep emitting the old
//! shape, so we declare DTOs that match it exactly.
//!
//! The same holds for `WaContact`: the existing UI uses `waId`, `name`,
//! `lastMessage`, `lastMessageTimestamp`, `unreadCount`, `profilePic` —
//! `WaContact` collapses some of these. Keeping a separate DTO here means
//! the UI contract is explicit, not implicit.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// One row in the contact sidebar.
///
/// Mirrors the per-contact subset of `Contact` (TS `definitions.ts` ~line
/// 2241) that the chat-contact-list component reads:
/// `_id`, `waId`, `name`, `phone`, `lastMessage`, `lastMessageTimestamp`,
/// `unreadCount`, plus the optional `profilePic` Meta sometimes provides.
///
/// `phoneNumberId` is included so the client can verify the contact still
/// belongs to the currently-selected business phone (the sidebar filters
/// by phone number id).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatContactSummary {
    /// Mongo `_id`. Serialised as `_id` because the React client does
    /// `contact._id.toString()` everywhere (see `chat-client.tsx` line 100).
    #[serde(rename = "_id")]
    pub id: ObjectId,

    /// WhatsApp `wa_id` — digits-only E.164. Used as the display fallback
    /// when `name` is empty (`chat-contact-list.tsx` line 209: `contact.name
    /// || contact.waId`).
    pub wa_id: String,

    /// Owning project. Returned for parity with the TS shape; the chat list
    /// itself filters by it server-side, but downstream actions
    /// (`markConversationAsRead`, attachment uploads, etc.) read it back off
    /// the contact object.
    pub project_id: ObjectId,

    /// Phone-number id (Meta business phone) the contact belongs to.
    pub phone_number_id: String,

    /// Display name. May be empty/None if Meta never sent a profile or if
    /// the contact was bulk-imported without one.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,

    /// Display phone. Independent of `wa_id` because some import flows store
    /// a pretty-printed E.164 (`+91 …`) here.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub phone: Option<String>,

    /// Truncated text of the last message exchanged with this contact.
    /// Written by the inbound + outbound webhook/send paths (see
    /// `webhook-processor.ts` lines 152 / 1480-1484). The chat-contact-list
    /// renders the empty fallback string (`'No messages yet.'`) when this is
    /// `None`, so we drop the field when absent.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_message: Option<String>,

    /// Timestamp of the most recent message. The contact list sorts by this
    /// descending (`chat-client.tsx` line 167), and the contact-list row
    /// renders a relative-time string off it.
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub last_message_timestamp: Option<DateTime<Utc>>,

    /// Number of unread inbound messages. Drives the badge in the contact
    /// list and the "Unread" filter tab. Defaults to 0 when missing.
    #[serde(default)]
    pub unread_count: i64,

    /// Optional Meta profile picture URL. Not all contacts have one — Meta's
    /// `business_profile.profile_picture_url` is opt-in.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub profile_pic: Option<String>,

    /// Created-at, returned because the TS payload includes it (the contact
    /// list doesn't render it but downstream CRM views do).
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub created_at: Option<DateTime<Utc>>,
}

/// One message row returned to the chat window.
///
/// The chat-message renderer (`chat-message.tsx`) reaches into many nested
/// `content` subtrees depending on `type`. To keep the renderer working
/// untouched we keep `content` as a raw [`serde_json::Value`] passthrough.
/// The fields named at the top level (`direction`, `type`, `status`,
/// `wamid`, …) are the ones the renderer reads off the message itself
/// (rather than off `content`).
///
/// The `text` and `media_id` fields aren't in the TS shape — they're a
/// convenience extraction the spec asks us to surface so a thin client can
/// render without the full nested-content walk. They're filled when we can
/// trivially pull them off `content` (text body for `type=="text"`, media
/// id for `image`/`video`/`audio`/`document`/`sticker`); otherwise they stay
/// `None` and the client falls back to walking `content` itself.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    /// Mongo `_id`.
    #[serde(rename = "_id")]
    pub id: ObjectId,

    /// `"in"` or `"out"`. The chat-message renderer keys its right/left
    /// alignment off this (`isOutgoing = message.direction === 'out'`).
    pub direction: String,

    /// Owning project. Carried through because the chat-message component's
    /// payment-status fetch uses it (`chat-message.tsx` line 187:
    /// `message.projectId.toString()`).
    pub project_id: ObjectId,

    /// FK back to the contact. Used by the client to thread reactions and
    /// quoted replies.
    pub contact_id: ObjectId,

    /// Message type discriminator: `text`, `image`, `interactive`,
    /// `template`, `payment_request`, `reaction`, `system`, `referral`, …
    /// The chat-message renderer switches on this to pick which `content`
    /// subtree to walk.
    #[serde(rename = "type")]
    pub message_type: String,

    /// Convenience extraction of the plain-text body for `type == "text"`.
    /// `None` for non-text messages — the renderer is expected to use
    /// `content` directly in that case. Kept separate from `content` rather
    /// than carved out, so the original shape is preserved.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,

    /// Convenience extraction of the Meta media id for media-bearing
    /// messages (`image`, `video`, `audio`, `document`, `sticker`). `None`
    /// otherwise. Used by the client to short-circuit the media-fetch
    /// without walking `content`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub media_id: Option<String>,

    /// Lifecycle status. Only meaningful for outbound messages
    /// (`pending`/`sent`/`delivered`/`read`/`failed`); inbound rows in the
    /// TS schema don't carry this field, so we keep it optional.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,

    /// Meta `wamid`. Used by the client to thread quoted replies and
    /// reaction overlays (`chat-window.tsx` line 120, line 126).
    pub wamid: String,

    /// When Meta says the message happened. Sorted on for ordering; rendered
    /// as the bubble timestamp (`chat-message.tsx` line 369:
    /// `const timestamp = message.messageTimestamp || message.createdAt;`).
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub message_timestamp: DateTime<Utc>,

    /// When *we* persisted the row. Tiebreaker for the merged sort, and
    /// fallback timestamp for the bubble label when `messageTimestamp` is
    /// missing.
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub created_at: Option<DateTime<Utc>>,

    /// Original raw content blob as stored in Mongo. This is the
    /// kitchen-sink field the chat-message renderer dives into for every
    /// rich type (`content.text.body`, `content.interactive.button_reply`,
    /// `content.payment_request.amount`, `content.order`, `content.referral`,
    /// `content.system.body`, …).
    #[serde(default)]
    pub content: serde_json::Value,

    /// Quoted-message context (Meta's `context.id` / `context.from`).
    /// Optional because most messages aren't replies.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context: Option<serde_json::Value>,

    /// `isRead` flag carried only on inbound rows. The contact-side unread
    /// counter is the canonical source of truth for the badge, but the
    /// per-row flag is kept so old read-state inspections still work.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_read: Option<bool>,

    /// Reaction overlay attached by the chat client when it folds a
    /// `type == "reaction"` message into the message it points at. Carried
    /// here for parity with the TS `AnyMessage` extension shape.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reaction: Option<serde_json::Value>,
}

/// Composite payload returned by [`ChatReader::initial_chat_data`].
///
/// Mirrors the wachat-relevant slice of `getInitialChatData`'s return value:
///
/// ```text
/// {
///   contacts: ChatContactSummary[],
///   messages: ChatMessage[],          // empty when no contact is selected
///   selectedContactId: ObjectId|null, // resolved from contactId/waId
/// }
/// ```
///
/// The TS action also returns the project document, the templates list, and
/// `selectedPhoneNumberId` — those belong to other read crates and are
/// composed at the HTTP boundary, not here.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InitialChatData {
    /// Recent contacts for the sidebar, sorted by `lastMessageTimestamp`
    /// descending and capped at the same 30-row limit the TS uses.
    pub contacts: Vec<ChatContactSummary>,

    /// Conversation history for the resolved contact, oldest-first. Empty
    /// when neither `contact_id` nor `wa_id` was provided, or when no
    /// matching contact exists.
    pub messages: Vec<ChatMessage>,

    /// Which contact `messages` belongs to. `None` when no selection was
    /// requested (or when the requested contact didn't resolve).
    pub selected_contact_id: Option<ObjectId>,
}
