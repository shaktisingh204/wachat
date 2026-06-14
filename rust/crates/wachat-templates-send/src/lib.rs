//! # wachat-templates-send
//!
//! **Send** side of the wachat templates module — Phase 3, slice 5 of the
//! SabNode TS-to-Rust port.
//!
//! Ports `handleSendTemplateMessage` from
//! `src/app/actions/send-template.actions.ts` (line ~16). The TS action
//! handles a few orthogonal concerns at once (auth, contact lookup,
//! header media upload, the `MARKETING_CAROUSEL` carousel branch). This
//! slice owns the **single template send** path:
//!
//! 1. Look up the stored `Template` by id (project-scoped).
//! 2. Convert it to a [`wachat_templates_engine::TemplateSpec`].
//! 3. Substitute caller-supplied variables → Meta `components` JSON.
//! 4. Normalize the recipient phone via [`wachat_phone::normalize_e164`].
//! 5. POST to `https://graph.facebook.com/{version}/{phone-number-id}/messages`
//!    via [`wachat_meta_client::MetaClient`].
//! 6. Insert an outgoing message log into the `outgoing_messages` Mongo
//!    collection.
//! 7. Return [`SendOutcome`] (the new log id + the Meta `wamid`).
//!
//! ## What this slice does **not** do
//!
//! * Header media upload (the TS `mediaSource === 'file'` branch). That's
//!   the job of the `wachat-media` crate; callers may pass an already-
//!   uploaded `media_id` via [`SendTemplateRequest::media_id`].
//! * `MARKETING_CAROUSEL` cards. A future slice owns that.
//! * `revalidatePath` and Next.js cache concerns.
//! * Auth / project ownership checks — callers must pass an already-
//!   authorized `&Project` (matching the `projectFromAction` arg in the
//!   TS).
//!
//! ## Meta API version
//!
//! The TS hard-codes `const API_VERSION = 'v23.0';` at the top of
//! `send-template.actions.ts`. We pin the same default at the [`MetaClient`]
//! construction site (callers own the `MetaClient` and pick the version).

#![forbid(unsafe_code)]

mod dto;
mod sender;

pub use dto::{SendOutcome, SendTemplateRequest};
pub use sender::TemplateSender;

/// Mongo collection name for outgoing message logs.
///
/// TS reference (`send-template.actions.ts` line 337):
/// ```text
/// db.collection('outgoing_messages').insertOne({ ... })
/// ```
pub const OUTGOING_MESSAGES_COLL: &str = "outgoing_messages";

/// Meta Graph API version the TS pins. Source of truth: line 14 of
/// `send-template.actions.ts`:
/// ```text
/// const API_VERSION = 'v23.0';
/// ```
///
/// Re-exported as a constant so callers building a [`MetaClient`] for this
/// slice can do so without re-encoding the version string.
pub const META_API_VERSION: &str = "v25.0";
