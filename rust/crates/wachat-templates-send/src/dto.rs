//! Request / response DTOs for [`crate::TemplateSender`].
//!
//! These are deliberately minimal — they carry only what the sender needs
//! to do its job, leaving the auth / contact-resolution / media-upload
//! concerns to upstream layers (matching the TS where
//! `handleSendTemplateMessage` accepts a flat `data` map and a pre-loaded
//! `projectFromAction`).

use bson::oid::ObjectId;

use wachat_templates_engine::Variables;

/// Caller-supplied input for a single template send.
///
/// Field mapping vs `handleSendTemplateMessage`'s `data` argument
/// (`send-template.actions.ts` lines 21-28):
///
/// | This field        | TS `data` key(s)                             |
/// | ----------------- | -------------------------------------------- |
/// | `recipient_phone` | resolved from `contactId` -> `contact.waId`  |
/// | `template_id`     | `data.templateId`                            |
/// | `variables`       | `...variables` (the rest spread)             |
/// | `media_id`        | result of the `mediaSource === 'file'` upload |
///
/// The TS resolves the recipient phone by looking up the `Contact` in
/// Mongo and reading `contact.waId`. We push that responsibility upstream:
/// callers pass the phone string directly. This keeps the sender free of
/// the contact-collection concern (which lives in `wachat-webhook-contacts`
/// and the future `wachat-contacts` slice).
#[derive(Debug, Clone)]
pub struct SendTemplateRequest {
    /// Recipient phone in any format `wachat_phone::normalize_e164`
    /// accepts. The sender will canonicalize it before passing to Meta.
    pub recipient_phone: String,

    /// Mongo `_id` of the stored template (in the `templates` collection).
    pub template_id: ObjectId,

    /// Caller-supplied substitution variables. See
    /// [`wachat_templates_engine::Variables`]. The TS flattens these onto
    /// the form data with magic key prefixes (`variable_body_1`,
    /// `variable_header_1`, ...); we use the typed `Variables` bag instead.
    pub variables: Variables,

    /// Optional already-uploaded Meta media id, used as the `image.id` /
    /// `video.id` / `document.id` parameter on the template's HEADER
    /// component. Pass `None` if the template has no media header or if
    /// the header is text-only.
    ///
    /// The TS `mediaSource === 'file'` branch uploads to
    /// `POST /{phone-number-id}/media` and threads the returned id into
    /// the same slot. That upload is owned by the `wachat-media` crate;
    /// we accept the id ready-made.
    pub media_id: Option<String>,
}

/// Result of a successful send.
///
/// Mirrors the two pieces of identity the TS persists / returns: the Mongo
/// `_id` of the new `outgoing_messages` row and Meta's `wamid`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SendOutcome {
    /// `_id` of the inserted `outgoing_messages` document.
    pub message_log_id: ObjectId,

    /// Meta `wamid` returned in `response.messages[0].id`. Used as the
    /// correlation key for status webhooks.
    pub wamid: String,
}
