//! `wachat-meta-dto` — typed request/response DTOs for the Meta WhatsApp Cloud
//! Graph API endpoints SabNode actually uses today.
//!
//! Scope: **wire types only**. No HTTP, no async, no internal domain logic.
//! Internal domain types (e.g. `Project`, `Contact`, `OutgoingMessage`) live
//! in `wachat-types`; this crate sits between the HTTP client (`wachat-meta-client`)
//! and the rest of the system.
//!
//! Conventions:
//! - All types `derive(Debug, Clone, Serialize, Deserialize)`.
//! - Field naming uses Meta's wire format (`snake_case`).
//! - Optional fields are `Option<T>` because Meta omits keys rather than
//!   nulling them, so `#[serde(default)]` is implicit via `Option`.
//! - Where the underlying schema is open-ended or varies dramatically per
//!   message subtype (interactive payloads, template components, errors data),
//!   we keep `serde_json::Value` rather than over-typing prematurely.
//! - Rust keyword field `type` is escaped as `r#type` — Serde de/serialises
//!   it transparently as `"type"` on the wire.

pub mod api_error;
pub mod media;
pub mod messages;
pub mod templates;
pub mod webhook;

pub use api_error::{MetaApiError, MetaApiErrorEnvelope};
pub use media::{MediaUploadResp, MediaUrlResp};
pub use messages::{
    MediaBody, SendContact, SendEnvelope, SendMessage, SendMessageId, SendResponse, TemplateBody,
    TemplateLanguage, TextBody,
};
pub use templates::{CreateTemplateReq, Cursors, ListTemplatesResp, Paging, TemplateRecord};
pub use webhook::{
    Change, ChangeValue, ContactProfile, Entry, InboundMessage, Metadata, StatusUpdate,
    WebhookContact, WebhookEvent,
};
