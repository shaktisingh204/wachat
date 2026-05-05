//! Request and outcome types for [`crate::TemplatesMutator`].
//!
//! Field naming is intentionally Rust-idiomatic (`snake_case`); these
//! are **not** wire DTOs. The mutator translates them into the exact
//! Meta payload shape (`type: 'BODY'`, `format: 'IMAGE'`, …) at call
//! time, byte-matching the TS handlers in `template.actions.ts`.
//!
//! ## Mapping notes
//!
//! - TS `headerFormat` is a free string — here we model it as
//!   [`HeaderFormat`] so the mutator does not have to validate at
//!   call time.
//! - TS `headerSampleFile` (a multipart `File`) and `headerSampleUrl`
//!   (a remote URL) are unified into [`HeaderMedia`]. Per the TS
//!   `getMediaHandleForTemplate` (line ~119), file *or* URL is
//!   accepted; both are uploaded via the resumable upload flow
//!   (`MediaUploader::upload_for_template_header`).
//! - TS button shapes are `{ type, text, url?, phone_number?, example? }`.
//!   We model that exactly with [`TemplateButton`].
//! - The TS `category` is uppercase Meta enum (`MARKETING` |
//!   `UTILITY` | `AUTHENTICATION`); we accept the type-safe
//!   `wachat_types::TemplateCategory`.

use serde::{Deserialize, Serialize};
use wachat_types::{Template, TemplateCategory};

/// Header format declared at the template level. Mirrors the TS
/// `headerFormat` form field (line ~282).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum HeaderFormat {
    None,
    Text,
    Image,
    Video,
    Document,
    Audio,
}

impl HeaderFormat {
    /// Wire string Meta expects in `components[].format`.
    pub(crate) fn as_meta_str(&self) -> &'static str {
        match self {
            HeaderFormat::None => "NONE",
            HeaderFormat::Text => "TEXT",
            HeaderFormat::Image => "IMAGE",
            HeaderFormat::Video => "VIDEO",
            HeaderFormat::Document => "DOCUMENT",
            HeaderFormat::Audio => "AUDIO",
        }
    }

    /// Whether this format requires a media handle (image/video/doc/audio).
    pub(crate) fn requires_media(&self) -> bool {
        matches!(
            self,
            HeaderFormat::Image
                | HeaderFormat::Video
                | HeaderFormat::Document
                | HeaderFormat::Audio
        )
    }
}

/// Header media payload supplied by the caller — either raw bytes
/// (e.g. from a multipart upload) or a URL the mutator should fetch
/// before uploading. Mirrors TS `getMediaHandleForTemplate(file, url, …)`.
#[derive(Debug, Clone)]
pub enum HeaderMedia {
    /// Already-buffered bytes plus the originating mime type.
    Bytes {
        bytes: bytes::Bytes,
        mime: String,
        filename: String,
    },
    /// Remote URL — the mutator will GET it (mirroring TS axios.get) and
    /// then drive the resumable upload.
    Url(String),
}

/// A single template button (CTA / quick reply / phone). Matches the TS
/// shape in `handleCreateTemplate`'s `formattedButtons` (L456).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct TemplateButton {
    /// `URL` | `PHONE_NUMBER` | `QUICK_REPLY` | `COPY_CODE` | `FLOW`.
    #[serde(rename = "type")]
    pub button_type: String,
    pub text: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub phone_number: Option<String>,
    /// Variable example values for URL buttons (`example: ["..."]`).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub example: Option<Vec<String>>,
}

/// Top-level create request. Mirrors the formData fields the TS handler
/// reads at lines ~256–460.
///
/// Validation (Zod schema) is the **caller's** responsibility. The
/// mutator accepts whatever shape it's given and forwards to Meta.
#[derive(Debug, Clone)]
pub struct CreateTemplateRequest {
    /// `formData.name` (or `formData.templateName`), trimmed.
    pub name: String,
    /// `formData.language` — Meta locale string e.g. `en_US`.
    pub language: String,
    /// `formData.category`.
    pub category: TemplateCategory,
    /// `formData.body` — required.
    pub body: String,
    /// Ordered example values for `{{1}}`, `{{2}}`, … in the body.
    /// Empty `Vec` if no body variables.
    pub body_examples: Vec<String>,
    /// `formData.footer` — empty string is treated as omitted.
    pub footer: Option<String>,
    /// `formData.headerFormat`.
    pub header_format: HeaderFormat,
    /// Required when `header_format == TEXT`.
    pub header_text: Option<String>,
    /// Single example value for the header text variable, if any.
    pub header_example: Option<String>,
    /// Required when `header_format` is one of IMAGE/VIDEO/DOCUMENT/AUDIO.
    pub header_media: Option<HeaderMedia>,
    /// Buttons (max 10 per Meta — we do not enforce here).
    pub buttons: Vec<TemplateButton>,
    /// Mirrors the TS `allow_category_change: true` literal at L304.
    pub allow_category_change: bool,
    /// Meta App id — required when `header_media` is provided (drives
    /// the resumable upload session). The TS reads this from
    /// `project.appId || NEXT_PUBLIC_META_APP_ID` (L251).
    pub app_id: Option<String>,
}

/// Flow-button template create. Maps 1:1 to `handleCreateFlowTemplate`
/// (L649). The TS unconditionally lower-cases + underscores `templateName`
/// (L669) — we keep the *raw* name and let the mutator normalize so the
/// caller can opt out by pre-normalizing.
#[derive(Debug, Clone)]
pub struct CreateFlowTemplateRequest {
    pub template_name: String,
    pub language: String,
    pub category: TemplateCategory,
    pub body_text: String,
    pub button_text: String,
    /// Meta Flow id placed in the FLOW button (`flow_id` field, L683).
    pub flow_id: String,
}

/// Edit request. Mirrors `handleEditTemplate` (L884) — every field is
/// optional because Meta's edit endpoint accepts a partial payload
/// (the TS code only includes what was supplied in the form).
#[derive(Debug, Clone)]
pub struct EditTemplateRequest {
    /// Required — used as the URL path segment (`POST /{metaTemplateId}`).
    pub meta_template_id: String,
    pub category: Option<TemplateCategory>,
    pub header_format: Option<HeaderFormat>,
    pub header_text: Option<String>,
    pub header_media: Option<HeaderMedia>,
    pub body: Option<String>,
    pub body_examples: Vec<String>,
    pub footer: Option<String>,
    pub buttons: Option<Vec<TemplateButton>>,
    /// App id for resumable upload (only required when `header_media`
    /// is `Some` and points at media — matching TS L919-925).
    pub app_id: Option<String>,
}

/// Aggregated outcome of a bulk-create call.
#[derive(Debug, Clone)]
pub struct BulkCreateOutcome {
    pub created: Vec<Template>,
    pub failed: Vec<BulkError>,
}

/// A single failed item from [`BulkCreateOutcome`].
#[derive(Debug, Clone)]
pub struct BulkError {
    /// Mirrors the TS error key — the template name we tried to create.
    pub name: String,
    pub message: String,
}
