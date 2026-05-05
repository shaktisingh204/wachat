//! Wire-format DTOs for the project-domain endpoints.
//!
//! The Next.js `Project` shape has dozens of feature-specific subtrees
//! (kanban columns, opt-in/out settings, agents, contacts, ...) and grows
//! fast. We deliberately model both list and detail responses as open
//! `serde_json::Value` payloads so handlers can pass through the stored
//! Mongo document verbatim — `JSON.parse(JSON.stringify(...))` is what the
//! TypeScript callers expect today.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

/// Query string accepted by `GET /v1/projects` for parity with the
/// `getProjects(query, type)` server action.
#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct ListQuery {
    /// Case-insensitive substring match on `name`.
    #[serde(default)]
    pub query: Option<String>,
    /// Restrict to projects with `wabaId` (`whatsapp`) or `facebookPageId`
    /// (`facebook`).
    #[serde(default, rename = "type")]
    pub kind: Option<String>,
}

/// Response body for `GET /v1/projects`. Returns the raw stored documents
/// (with ObjectIds rendered as hex strings and dates as ISO 8601) so the
/// caller can drive existing UI that already understands the `Project`
/// shape.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ListResponse {
    #[schema(value_type = Vec<Object>)]
    pub projects: Vec<Value>,
}

/// Response body for `GET /v1/projects/:id`. Includes the project document
/// with the matching `plan` joined under `plan` (the Next.js code expects
/// the same field).
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ProjectResponse {
    #[schema(value_type = Object)]
    pub project: Value,
}
