//! Wire DTOs (HTTP request / response shapes) the email-templates
//! router speaks.
//!
//! Every body / query uses `#[serde(rename_all = "camelCase")]` to
//! match the JSON shape the TS client sends. The DTOs intentionally
//! mirror the TS source of truth at `src/lib/email/types.ts`:
//!
//!   * [`EmailTemplateV2`]      ↔ `email_templates` row
//!   * [`EmailTemplateBlock`]   ↔ `email_template_blocks` row
//!   * [`EmailBrandKit`]        ↔ `email_brand_kits` row
//!   * [`EmailBuilderDocument`] ↔ block-tree document persisted on
//!                                 `EmailTemplateV2.builderJson`
//!
//! Mongo ids are exchanged as 24-char hex strings on the wire —
//! `_id: bson::oid::ObjectId` lives in the storage shape, never in the
//! HTTP envelope.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;

// ---------------------------------------------------------------------------
// Pagination + simple envelopes
// ---------------------------------------------------------------------------

/// `?page=&limit=&q=&category=` query for paginated list endpoints.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default = "default_page")]
    pub page: u64,
    #[serde(default = "default_limit")]
    pub limit: u64,
    /// Free-text search across `name` / `subject` / `category`.
    #[serde(default)]
    pub q: Option<String>,
    /// Optional category filter.
    #[serde(default)]
    pub category: Option<String>,
}

fn default_page() -> u64 {
    1
}
fn default_limit() -> u64 {
    20
}

/// `{ items, total, page, limit }` envelope used by every list
/// endpoint in this crate.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse<T> {
    pub items: Vec<T>,
    pub total: u64,
    pub page: u64,
    pub limit: u64,
}

/// `{ deleted: bool }` — soft-delete envelope.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteResponse {
    pub deleted: bool,
}

// ---------------------------------------------------------------------------
// Builder document — block tree persisted on EmailTemplateV2.builderJson
// ---------------------------------------------------------------------------

/// Mirrors `EmailBuilderBlockType` in `src/lib/email/types.ts`.
///
/// Kept as a free-form string at the wire level (`#[serde(other)]`) so
/// the TS side can add new block types without breaking the Rust
/// crate. The render path falls back to passing the block through as
/// raw HTML when it doesn't know the type.
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailBuilderBlock {
    pub id: String,
    /// One of `text`, `image`, `button`, `columns`, `divider`,
    /// `spacer`, `social`, `video`, `footer`, `html`, `amp` —
    /// or any future type (treated as opaque).
    #[serde(rename = "type")]
    pub kind: String,
    /// Per-block props. Renderer keys vary by `kind`:
    ///
    ///   * `text`    → `{ text: string }`
    ///   * `image`   → `{ src, alt?, href?, width? }`
    ///   * `button`  → `{ label, href, backgroundColor?, color? }`
    ///   * `columns` → `{ widths?: number[] }`
    ///   * `divider` → `{ color?, padding? }`
    ///   * `spacer`  → `{ height?: number }`
    ///   * `footer`  → `{ companyName, address, unsubscribeUrl? }`
    ///   * `html`    → `{ html: string }` (raw passthrough)
    #[serde(default)]
    pub props: Value,
    /// Child blocks. Used by container blocks (`columns`).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<EmailBuilderBlock>>,
}

/// Top-level builder document. `version` is always `1` in this phase.
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailBuilderDocument {
    #[serde(default = "default_doc_version")]
    pub version: u32,
    #[serde(default)]
    pub settings: EmailBuilderSettings,
    #[serde(default)]
    pub blocks: Vec<EmailBuilderBlock>,
}

fn default_doc_version() -> u32 {
    1
}

/// Top-level page settings — applied as `<mj-body>` / `<mj-attributes>`
/// in the render.
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailBuilderSettings {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub background_color: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub content_background_color: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub font_family: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub width: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub preheader: Option<String>,
}

// ---------------------------------------------------------------------------
// EmailTemplateV2 — `email_templates` row
// ---------------------------------------------------------------------------

/// Mirrors `EmailTemplateV2` in `src/lib/email/types.ts`.
///
/// `_id` and `userId` are stored as `ObjectId` but serialise to plain
/// 24-char hex strings on the wire (via `bson`'s default oid format).
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailTemplateV2 {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub user_id: ObjectId,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subject: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub builder_json: Option<EmailBuilderDocument>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mjml: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub html: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub amp: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub thumbnail_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_library: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub brand_kit_id: Option<ObjectId>,
    #[serde(default)]
    pub version: u32,
    /// Soft-delete marker. Defaults to `"active"`; soft-deletes set it
    /// to `"archived"` so list endpoints can transparently filter.
    #[serde(default)]
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// `POST /` body — create a new template.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTemplateInput {
    pub name: String,
    #[serde(default)]
    pub subject: Option<String>,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub builder_json: Option<EmailBuilderDocument>,
    #[serde(default)]
    pub mjml: Option<String>,
    #[serde(default)]
    pub html: Option<String>,
    #[serde(default)]
    pub amp: Option<String>,
    #[serde(default)]
    pub thumbnail_url: Option<String>,
    #[serde(default)]
    pub is_library: Option<bool>,
    #[serde(default)]
    pub brand_kit_id: Option<String>,
}

/// `PATCH /{template_id}` body — partial update. All fields optional.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTemplateInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub subject: Option<String>,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub builder_json: Option<EmailBuilderDocument>,
    #[serde(default)]
    pub mjml: Option<String>,
    #[serde(default)]
    pub html: Option<String>,
    #[serde(default)]
    pub amp: Option<String>,
    #[serde(default)]
    pub thumbnail_url: Option<String>,
    #[serde(default)]
    pub is_library: Option<bool>,
    #[serde(default)]
    pub brand_kit_id: Option<String>,
}

// ---------------------------------------------------------------------------
// EmailTemplateBlock — saved reusable content block
// ---------------------------------------------------------------------------

/// Mirrors `EmailTemplateBlock` in `src/lib/email/types.ts`.
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailTemplateBlock {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub user_id: ObjectId,
    pub name: String,
    pub block: EmailBuilderBlock,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub thumbnail_url: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// `POST /blocks` body — save a new reusable block.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateBlockInput {
    pub name: String,
    pub block: EmailBuilderBlock,
    #[serde(default)]
    pub thumbnail_url: Option<String>,
}

// ---------------------------------------------------------------------------
// EmailBrandKit — `email_brand_kits` row
// ---------------------------------------------------------------------------

/// `palette` block on a [`EmailBrandKit`].
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailBrandPalette {
    pub primary: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub secondary: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub background: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub muted: Option<String>,
}

/// `fonts` block on a [`EmailBrandKit`].
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailBrandFonts {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub heading: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub body: Option<String>,
}

/// `logo` block — references a SabFiles URL.
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailBrandLogo {
    pub url: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub alt: Option<String>,
}

/// `social` row.
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailBrandSocial {
    pub network: String,
    pub url: String,
}

/// `footer` block — CAN-SPAM / GDPR boilerplate.
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailBrandFooter {
    pub company_name: String,
    pub address: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub unsubscribe_text: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub preferences_text: Option<String>,
}

/// Mirrors `EmailBrandKit` in `src/lib/email/types.ts`.
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailBrandKit {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub user_id: ObjectId,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub logo: Option<EmailBrandLogo>,
    pub palette: EmailBrandPalette,
    #[serde(default)]
    pub fonts: EmailBrandFonts,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub social: Option<Vec<EmailBrandSocial>>,
    pub footer: EmailBrandFooter,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// `POST /brand-kits` body.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateBrandKitInput {
    pub name: String,
    #[serde(default)]
    pub logo: Option<EmailBrandLogo>,
    pub palette: EmailBrandPalette,
    #[serde(default)]
    pub fonts: EmailBrandFonts,
    #[serde(default)]
    pub social: Option<Vec<EmailBrandSocial>>,
    pub footer: EmailBrandFooter,
}

/// `PATCH /brand-kits/{kit_id}` body — partial update.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateBrandKitInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub logo: Option<EmailBrandLogo>,
    #[serde(default)]
    pub palette: Option<EmailBrandPalette>,
    #[serde(default)]
    pub fonts: Option<EmailBrandFonts>,
    #[serde(default)]
    pub social: Option<Vec<EmailBrandSocial>>,
    #[serde(default)]
    pub footer: Option<EmailBrandFooter>,
}

// ---------------------------------------------------------------------------
// Render / preview
// ---------------------------------------------------------------------------

/// `POST /{template_id}/render` body. Optional `builderJson` override
/// lets the caller render an in-progress builder document without
/// persisting it first (the wizard preview path).
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderTemplateInput {
    /// Override the persisted `builderJson` (e.g. live preview from the
    /// in-progress builder).
    #[serde(default)]
    pub builder_json: Option<EmailBuilderDocument>,
    /// Override the persisted brand kit id (hex `ObjectId`).
    #[serde(default)]
    pub brand_kit_id: Option<String>,
}

/// `POST /{template_id}/preview` body — render plus merge-tag sample
/// data substitution. `sampleData` is a flat string map; tags shaped
/// `{{ key }}` in the rendered HTML are substituted before return.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewTemplateInput {
    #[serde(default)]
    pub builder_json: Option<EmailBuilderDocument>,
    #[serde(default)]
    pub brand_kit_id: Option<String>,
    /// Flat `{ key: value }` map. Both keys and values are stringified
    /// for substitution.
    #[serde(default)]
    pub sample_data: Option<Value>,
}

/// Render response shape — matches the spec contract:
/// `{ html, mjml, warnings }`.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderResponse {
    pub html: String,
    pub mjml: String,
    pub warnings: Vec<String>,
}
