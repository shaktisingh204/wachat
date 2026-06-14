//! # wachat-send
//!
//! **Main message send** crate for the SabNode wachat module — Phase 4,
//! slice 1 of the TS-to-Rust port.
//!
//! Ports `handleSendMessage` from `src/app/actions/whatsapp.actions.ts`
//! (line ~406). The TS action handles the chat-side send path: text
//! messages and the four media types (image / video / document / audio).
//! Template sends live in the sibling [`wachat_templates_send`] crate.
//!
//! ## Flow
//!
//! 1. Build the Meta payload from a typed [`SendMessageRequest`].
//! 2. POST to `https://graph.facebook.com/{version}/{phone-number-id}/messages`
//!    via [`wachat_meta_client::MetaClient`].
//! 3. Read `wamid` out of `response.messages[0].id` (TS line 473).
//! 4. Insert an `outgoing_messages` doc into Mongo with the **exact** field
//!    set the TS writes at lines 484-487.
//! 5. Return [`SendOutcome`] (the new log id + the Meta `wamid`).
//!
//! ## What this slice does **not** do
//!
//! * The base64 → multipart upload branch from the TS (lines 430-445) is
//!   factored out: callers either pass a pre-uploaded `media_id` or a
//!   public `link`. Raw base64 uploads belong to a callers-of-this-crate
//!   adapter that uses `wachat-media::MediaUploader::upload_for_messages`
//!   directly. The constructor still threads a [`MediaUploader`] in so the
//!   future "upload from bytes" branch can be added without an API churn.
//! * Contact upserts and `revalidatePath` (TS lines 488-496). Those
//!   concerns live in `wachat-webhook-contacts` and the Next.js layer
//!   respectively.
//! * Auth / project-ownership checks. Callers must pass an already-
//!   authorized `&Project` (matching the `projectFromAction` arg in the TS).
//!
//! ## Meta API version
//!
//! The TS hard-codes `const API_VERSION = 'v23.0';` at the top of
//! `whatsapp.actions.ts`. We pin the same default at the [`MetaClient`]
//! construction site (callers own the `MetaClient` and pick the version).

#![forbid(unsafe_code)]

mod dto;
mod sender;

pub use dto::{SendMessageRequest, SendOutcome};
pub use sender::MessageSender;

/// Mongo collection name for outgoing message logs.
///
/// TS reference (`whatsapp.actions.ts` line 484):
/// ```text
/// db.collection('outgoing_messages').insertOne({ ... })
/// ```
pub const OUTGOING_MESSAGES_COLL: &str = "outgoing_messages";

/// Meta Graph API version the TS pins. Source of truth: top of
/// `whatsapp.actions.ts`:
/// ```text
/// const API_VERSION = 'v23.0';
/// ```
///
/// Re-exported as a constant so callers building a [`MetaClient`] for this
/// slice can do so without re-encoding the version string.
pub const META_API_VERSION: &str = "v25.0";
