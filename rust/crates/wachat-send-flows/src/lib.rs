//! # wachat-send-flows
//!
//! **Interactive "flow" senders** for the SabNode wachat module — Phase 4,
//! slice 3 of the TS-to-Rust port.
//!
//! Ports two sibling actions from
//! `src/app/actions/whatsapp.actions.ts`:
//!
//! * `handleSendLocationRequestMessage` (line 1565) — Meta interactive
//!   subtype `location_request_message` (the user is shown a "Send
//!   location" button that opens the WhatsApp location picker).
//! * `handleSendAddressMessage` (line 1616) — Meta interactive subtype
//!   `address_message` (the user fills out a structured address form,
//!   prefilled with `country` + optional `values` / `saved_address_id`).
//!
//! Both actions share the same orchestration:
//!
//! 1. Normalize the recipient phone via [`wachat_phone::normalize_e164`].
//! 2. Build the Meta `interactive` payload (subtype-specific shape —
//!    quoted in [`sender::FlowSender`] doc comments and matched
//!    byte-for-byte against the TS).
//! 3. POST to `https://graph.facebook.com/{version}/{phone-number-id}/messages`
//!    via [`wachat_meta_client::MetaClient`].
//! 4. Insert an outgoing message log into the `outgoing_messages` Mongo
//!    collection with `type: "interactive"` and `content` = the full
//!    payload that was posted (matches the TS — TS line 1601 / 1664).
//! 5. Return [`SendOutcome`] (the new log id + the Meta `wamid`).
//!
//! ## What this slice does **not** do
//!
//! * Auth / project ownership checks. Callers pass an already-authorised
//!   `&Project`, matching the TS pattern of `getProjectById(projectId)`
//!   running upstream of the action body.
//! * Contact resolution. The TS resolves a `Contact` document and writes
//!   `contactId` into the log; this slice keeps the public API to
//!   `(to, body_text, ...)` and **omits the `contactId` field** in the
//!   inserted document. Readers that care about the contact link can
//!   JOIN on `recipient` (the bare-digits phone). This matches the
//!   sibling `wachat-templates-send` slice's documented choice.
//! * `lastMessage` / `lastMessageTimestamp` updates on the contact
//!   document. The TS does this inline (lines 1605-1608 / 1668-1671);
//!   we leave it to the caller / a future `wachat-contacts` slice.
//! * `revalidatePath` and Next.js cache concerns — irrelevant outside
//!   the Next runtime.
//!
//! ## Meta API version
//!
//! The TS hard-codes `const API_VERSION = 'v23.0';` at the top of
//! `whatsapp.actions.ts`. We pin the same default at the [`MetaClient`]
//! construction site (callers own the `MetaClient` and pick the version)
//! and re-export it as [`META_API_VERSION`].
//!
//! [`MetaClient`]: wachat_meta_client::MetaClient

#![forbid(unsafe_code)]

mod dto;
mod sender;

pub use dto::{SendAddressReq, SendLocationReq, SendOutcome};
pub use sender::FlowSender;

/// Mongo collection name for outgoing message logs.
///
/// TS reference (`whatsapp.actions.ts` lines 1599 / 1662):
/// ```text
/// db.collection('outgoing_messages').insertOne({ ... })
/// ```
pub const OUTGOING_MESSAGES_COLL: &str = "outgoing_messages";

/// Meta Graph API version the TS pins. Source of truth: the top of
/// `whatsapp.actions.ts`:
/// ```text
/// const API_VERSION = 'v23.0';
/// ```
pub const META_API_VERSION: &str = "v25.0";
