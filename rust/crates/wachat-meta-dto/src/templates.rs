//! Request shape for `POST /{waba-id}/message_templates` (template create)
//! and response shape for `GET /{waba-id}/message_templates` (template list).
//!
//! Source of truth: `src/app/actions/template.actions.ts`.
//! - List call requests fields:
//!   `name,components,language,status,category,id,quality_score`
//! - Create call sends `name`, `language`, `category`, `components` (an array
//!   of typed objects: `HEADER`, `BODY`, `FOOTER`, `BUTTONS`, `CAROUSEL`).
//!
//! `components` and `quality_score` stay as `serde_json::Value` because their
//! shape varies per component type and Meta evolves both frequently.

use serde::{Deserialize, Serialize};

/// Body of `POST /{waba-id}/message_templates`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTemplateReq {
    pub name: String,
    /// Locale code, e.g. `"en_US"`. Note: at this endpoint Meta accepts a
    /// flat string here, *not* the `{ "code": "..." }` object used at send time.
    pub language: String,
    /// One of `MARKETING` | `UTILITY` | `AUTHENTICATION`.
    pub category: String,
    pub components: Vec<serde_json::Value>,
}

/// `GET /{waba-id}/message_templates` response.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListTemplatesResp {
    #[serde(default)]
    pub data: Vec<TemplateRecord>,
    pub paging: Option<Paging>,
}

/// A single template row as returned by Meta.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateRecord {
    pub id: String,
    pub name: String,
    pub language: String,
    /// `APPROVED` | `PENDING` | `REJECTED` | `PAUSED` | `DISABLED` | `IN_APPEAL` | ...
    pub status: String,
    pub category: String,
    #[serde(default)]
    pub components: Vec<serde_json::Value>,
    /// Open-ended in Meta's response (`{ score, date, reasons }` and friends).
    pub quality_score: Option<serde_json::Value>,
}

/// Standard Graph API cursor-based paging block.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Paging {
    pub cursors: Option<Cursors>,
    pub next: Option<String>,
    pub previous: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Cursors {
    pub before: Option<String>,
    pub after: Option<String>,
}
