//! Wire DTOs for the wachat link-generator endpoints. `camelCase` to
//! match the JSON the `/wachat/whatsapp-link-generator` page sends.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

/// Body for `POST /projects/{project_id}/links` — persist a generated
/// `wa.me` link. Mirrors `saveGeneratedLink(projectId, url)` plus the
/// optional metadata the page already computes (phone + message).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SaveLinkBody {
    /// The generated `wa.me` URL.
    pub url: String,
    /// Optional sanitized E.164 phone (no `+`) the link targets.
    #[serde(default)]
    pub phone: Option<String>,
    /// Optional pre-filled message bundled into the link.
    #[serde(default)]
    pub message: Option<String>,
}

/// Response for `GET /projects/{project_id}/links` — the project's
/// saved links as cleaned JSON docs.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListLinksResponse {
    #[schema(value_type = Vec<Object>)]
    pub links: Vec<Value>,
}

/// Body for `POST /shorten` — the long URL to alias.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ShortenBody {
    /// The original (long) URL to shorten.
    pub url: String,
}

/// Response for `POST /shorten` — the stored alias and its internal
/// short path (`/s/{shortCode}`). No external shortener is hit.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ShortenResponse {
    pub success: bool,
    /// 8-char code derived deterministically from the doc ObjectId.
    pub short_code: String,
    /// Internal short path, e.g. `/s/1a2b3c4d`.
    pub short_path: String,
    /// Echo of the original URL.
    pub original_url: String,
}
