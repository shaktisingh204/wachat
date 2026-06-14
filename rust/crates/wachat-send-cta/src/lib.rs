//! # wachat-send-cta
//!
//! **Catalog** + **CTA URL** interactive message senders — Phase 4, slice 2
//! of the SabNode TS-to-Rust port.
//!
//! Ports two TypeScript actions from
//! `src/app/actions/whatsapp.actions.ts`:
//!
//! * [`CtaSender::send_catalog`] — `handleSendCatalogMessage` (line 1052),
//!   builds the `interactive.type = "product_list"` payload around a
//!   project-connected catalog and a list of product retailer ids.
//! * [`CtaSender::send_cta_url`] — `handleSendCtaUrlMessage` (line 1506),
//!   builds the `interactive.type = "cta_url"` payload (CTA button → URL).
//!
//! Both methods share the same plumbing: validate project access, normalize
//! the recipient phone, POST to `{phone-number-id}/messages` via
//! [`wachat_meta_client::MetaClient`], then insert an `outgoing_messages`
//! log row that mirrors the TS document field-for-field.
//!
//! ## What this slice does **not** do
//!
//! * Contact-collection lookups. The TS resolves `contactId → contact.waId`
//!   and `contact.phoneNumberId`; we accept these as request fields so the
//!   sender stays free of the Mongo `contacts` collection.
//! * Plan / credit gating. Those live in upstream crates.
//! * Updating `contacts.lastMessage` / `contacts.lastMessageTimestamp`. The
//!   TS does this inline on `cta_url`; the equivalent batch update belongs
//!   in the future `wachat-contacts` slice.
//! * Catalog id resolution. The TS reads `project.connectedCatalogId`;
//!   we accept the catalog id directly on the request so callers can override
//!   per-send (matching the form-data payload).
//! * `revalidatePath` / Next.js cache concerns.
//!
//! ## Meta API version
//!
//! Pinned to `v23.0` (matches the TS `API_VERSION` constant).

#![forbid(unsafe_code)]

mod dto;
mod sender;

pub use dto::{SendCatalogReq, SendCtaUrlReq, SendOutcome};
pub use sender::CtaSender;

/// Mongo collection name for outgoing message logs.
///
/// TS reference (`whatsapp.actions.ts` line 1548):
/// ```text
/// db.collection('outgoing_messages').insertOne({ ... })
/// ```
pub const OUTGOING_MESSAGES_COLL: &str = "outgoing_messages";

/// Meta Graph API version the TS pins. Source of truth: `API_VERSION` in
/// `whatsapp.actions.ts`.
pub const META_API_VERSION: &str = "v25.0";
