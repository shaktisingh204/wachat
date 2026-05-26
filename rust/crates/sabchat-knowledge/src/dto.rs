//! Wire-format DTOs for the SabChat knowledge-base endpoints.
//!
//! Three resource shapes — **portal**, **category**, **article** — plus
//! the request / response envelopes that flow over each route. Every
//! body / query uses `#[serde(rename_all = "camelCase")]` to round-trip
//! to the Next.js side without manual renames.
//!
//! Stored documents are returned to the caller as `serde_json::Value`
//! (via `document_to_clean_json`) so we don't double-define the on-disk
//! shape here — DTOs are purely for the request side. The same approach
//! sibling crates (`sabchat-inboxes`, `wachat-contacts`) take.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

/// Default page size for `list_articles`. Kept modest because the
/// public read endpoint streams excerpts inline; clients can paginate
/// for more.
pub const ARTICLES_PER_PAGE: i64 = 20;

/// Length, in chars, of the `excerpt` field projected by the public
/// list endpoint when the row doesn't already carry an explicit
/// excerpt. Mirrors the spec ("first 200 chars of body").
pub const EXCERPT_CHARS: usize = 200;

fn default_page() -> u64 {
    1
}

fn default_sort_order() -> i32 {
    0
}

fn default_language() -> String {
    "en".to_owned()
}

fn default_status() -> String {
    "draft".to_owned()
}

// ===========================================================================
// PORTAL DTOs
// ===========================================================================

/// `theme.color` shape — a single hex / CSS colour today, kept as a
/// dedicated struct so the schema can grow (font, logo, …) without
/// breaking wire compatibility.
#[derive(Debug, Clone, Default, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PortalTheme {
    /// Primary brand colour (e.g. `#0EA5E9`). Optional — when missing
    /// the public portal endpoint falls back to a neutral default in
    /// the renderer.
    #[serde(default)]
    pub color: Option<String>,
}

/// Body for `POST /v1/sabchat/kb/portals` — create a new help-center
/// portal under the caller's tenant.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreatePortalBody {
    pub name: String,
    /// URL-safe slug — must be unique **per tenant**. Validation
    /// happens in the handler; the duplicate check surfaces a 409.
    pub slug: String,
    #[serde(default = "default_language")]
    pub default_language: String,
    #[serde(default)]
    pub theme: PortalTheme,
    /// Optional CNAME / custom domain. The renderer matches against
    /// this when serving the help center outside the default URL.
    #[serde(default)]
    pub custom_domain: Option<String>,
    /// Defaults to `true` — callers can pre-create a portal in the
    /// disabled state by passing `false`.
    #[serde(default = "default_true")]
    pub active: bool,
}

fn default_true() -> bool {
    true
}

/// Body for `PATCH /v1/sabchat/kb/portals/{id}` — partial portal
/// update. Every field is optional; only the ones the caller provides
/// get `$set`.
#[derive(Debug, Clone, Default, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePortalBody {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub slug: Option<String>,
    #[serde(default)]
    pub default_language: Option<String>,
    #[serde(default)]
    pub theme: Option<PortalTheme>,
    #[serde(default)]
    pub custom_domain: Option<String>,
    #[serde(default)]
    pub active: Option<bool>,
}

/// Single-portal response envelope.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PortalResponse {
    #[schema(value_type = Object)]
    pub portal: Value,
}

/// List response envelope.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListPortalsResponse {
    #[schema(value_type = Vec<Object>)]
    pub portals: Vec<Value>,
    pub total: u64,
}

// ===========================================================================
// CATEGORY DTOs
// ===========================================================================

/// Body for `POST /v1/sabchat/kb/categories` — create a category under
/// a portal. Categories form a tree via the optional `parent_id`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateCategoryBody {
    pub portal_id: String,
    pub name: String,
    pub slug: String,
    /// Hex `ObjectId` of the parent category, or `None` for a
    /// top-level entry.
    #[serde(default)]
    pub parent_id: Option<String>,
    /// Lower numbers sort first. Default 0 mirrors the spec field.
    #[serde(default = "default_sort_order")]
    pub sort_order: i32,
}

/// Body for `PATCH /v1/sabchat/kb/categories/{id}` — partial update.
/// Every field is optional.
#[derive(Debug, Clone, Default, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCategoryBody {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub slug: Option<String>,
    /// Setting `parent_id` to an empty string explicitly clears the
    /// parent (re-parents to top-level). `None` means "leave unchanged".
    #[serde(default)]
    pub parent_id: Option<String>,
    #[serde(default)]
    pub sort_order: Option<i32>,
}

/// Query string for `GET /v1/sabchat/kb/categories`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListCategoriesQuery {
    /// Optional portal filter — when omitted the result spans every
    /// portal the caller's tenant owns.
    #[serde(default)]
    pub portal_id: Option<String>,
}

/// Single-category response envelope.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CategoryResponse {
    #[schema(value_type = Object)]
    pub category: Value,
}

/// List response envelope.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListCategoriesResponse {
    #[schema(value_type = Vec<Object>)]
    pub categories: Vec<Value>,
    pub total: u64,
}

// ===========================================================================
// ARTICLE DTOs
// ===========================================================================

/// Body for `POST /v1/sabchat/kb/articles` — create a new article in
/// `draft` status by default. Callers can pass an explicit `status` if
/// they want to ship live in one shot (we also expose dedicated
/// `/publish` and `/archive` endpoints for the lifecycle transitions).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateArticleBody {
    pub portal_id: String,
    #[serde(default)]
    pub category_id: Option<String>,
    pub title: String,
    pub slug: String,
    /// Markdown body. Rendering to HTML happens in the Next.js side
    /// (the public read endpoint surfaces raw markdown plus an
    /// excerpt).
    pub body: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default = "default_language")]
    pub language: String,
    /// One of `draft` | `published` | `archived`. Validated in the
    /// handler.
    #[serde(default = "default_status")]
    pub status: String,
    /// Hex `ObjectId` of the article's author (an agent / staff
    /// member). Optional — anonymous portals can omit this.
    #[serde(default)]
    pub author_id: Option<String>,
}

/// Body for `PATCH /v1/sabchat/kb/articles/{id}` — partial update.
#[derive(Debug, Clone, Default, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateArticleBody {
    #[serde(default)]
    pub category_id: Option<String>,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub slug: Option<String>,
    #[serde(default)]
    pub body: Option<String>,
    #[serde(default)]
    pub tags: Option<Vec<String>>,
    #[serde(default)]
    pub language: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub author_id: Option<String>,
}

/// Query string for `GET /v1/sabchat/kb/articles`.
///
/// `q` engages `$text` search — the handler ensures the collection has
/// the appropriate text index at startup time (in practice the index
/// is created by the orchestrator on first run).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListArticlesQuery {
    #[serde(default)]
    pub portal_id: Option<String>,
    #[serde(default)]
    pub category_id: Option<String>,
    /// `draft` | `published` | `archived` — omit to return everything.
    #[serde(default)]
    pub status: Option<String>,
    /// Full-text search query.
    #[serde(default)]
    pub q: Option<String>,
    #[serde(default = "default_page")]
    pub page: u64,
}

/// Single-article response envelope.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ArticleResponse {
    #[schema(value_type = Object)]
    pub article: Value,
}

/// List response envelope.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListArticlesResponse {
    #[schema(value_type = Vec<Object>)]
    pub articles: Vec<Value>,
    pub total: u64,
}

// ===========================================================================
// PUBLIC READ DTOs
// ===========================================================================

/// Query string for `GET /v1/sabchat/kb-public/portals/{slug}/articles`.
///
/// All three filters are optional and compose. `q` runs against the
/// `$text` index for the published article set.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PublicListArticlesQuery {
    #[serde(default)]
    pub q: Option<String>,
    /// Filter by category **slug** (not id) — easier for static-site
    /// renderers to reason about than opaque ObjectIds.
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub tag: Option<String>,
}

/// Public portal envelope. Deliberately narrow — we never leak the
/// tenant id or internal flags.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PublicPortalResponse {
    pub name: String,
    pub theme: PortalTheme,
    pub default_language: String,
}

/// Single row in the public article list. Fields are projected
/// server-side — body is never shipped here.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PublicArticleSummary {
    pub title: String,
    pub slug: String,
    pub excerpt: String,
    #[serde(default)]
    pub tags: Vec<String>,
    /// `updatedAt` as ISO-8601 string — matches the JSON shape the
    /// Next.js side already expects from `document_to_clean_json`.
    #[serde(default)]
    pub updated_at: Option<Value>,
}

/// Public list response envelope.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PublicListArticlesResponse {
    pub articles: Vec<PublicArticleSummary>,
    pub total: u64,
}

/// Public single-article envelope. Returns the raw stored document
/// (minus tenant_id) so renderers have everything they need.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PublicArticleResponse {
    #[schema(value_type = Object)]
    pub article: Value,
}

/// Body for `POST /v1/sabchat/kb-public/portals/{slug}/articles/{articleSlug}/helpful`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct HelpfulBody {
    /// `true` increments `helpful_count`; `false` increments
    /// `not_helpful_count`.
    pub helpful: bool,
}

// ===========================================================================
// Generic success envelope
// ===========================================================================

/// `{ success: true }` shape returned by every PATCH / DELETE /
/// lifecycle endpoint — mirrors the wachat-contacts / sabchat-inboxes
/// crates so the front-end has one shape to reason about.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct SuccessResponse {
    pub success: bool,
}

impl SuccessResponse {
    pub fn ok() -> Self {
        Self { success: true }
    }
}
