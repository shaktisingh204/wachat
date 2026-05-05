//! Wire shapes for the wachat-facebook-crm endpoints.
//!
//! The legacy TS handlers return `JSON.parse(JSON.stringify(...))` of the
//! Mongo document plus a couple of `{success?: boolean, error?: string}`
//! envelopes. We deliberately mirror those envelopes so callers don't have
//! to special-case Rust 4xx vs the existing optional-`error` shape.

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Subscribers list — `getFacebookSubscribers`.
#[derive(Debug, Default, Clone, Serialize)]
pub struct SubscribersResult {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subscribers: Option<Vec<Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Kanban view body — `getFacebookKanbanData`.
///
/// Field shapes (project + columns) are forwarded as cleaned BSON-as-JSON
/// so the existing UI can keep using its open `Project` shape.
#[derive(Debug, Default, Clone, Serialize)]
pub struct KanbanResult {
    pub project: Option<Value>,
    pub columns: Vec<KanbanColumn>,
}

#[derive(Debug, Clone, Serialize)]
pub struct KanbanColumn {
    pub name: String,
    pub conversations: Vec<Value>,
}

/// Body for `POST /subscribers/:id/status`.
#[derive(Debug, Clone, Deserialize)]
pub struct UpdateStatusBody {
    pub status: String,
}

/// Body for `POST /projects/:id/kanban/statuses`.
#[derive(Debug, Clone, Deserialize)]
pub struct SaveKanbanStatusesBody {
    pub statuses: Vec<String>,
}

/// Generic `{ success, error }` ack used by the kanban + label + block
/// mutation endpoints to mirror the TS shape.
#[derive(Debug, Default, Clone, Serialize)]
pub struct SuccessResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// `getCustomLabels` / `getLabelsForUser` envelope.
#[derive(Debug, Default, Clone, Serialize)]
pub struct LabelsResult {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub labels: Option<Vec<Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// `createCustomLabel` body.
#[derive(Debug, Clone, Deserialize)]
pub struct CreateLabelBody {
    pub name: String,
}

/// `createCustomLabel` result envelope.
#[derive(Debug, Default, Clone, Serialize)]
pub struct CreateLabelResult {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Body for `POST .../labels/:labelId/users` and the matching DELETE.
#[derive(Debug, Clone, Deserialize)]
pub struct UserPsidBody {
    pub psid: String,
}

/// Body for `POST /projects/:id/blocked` (and DELETE — we accept the same
/// shape on either verb so callers don't fork their forms).
#[derive(Debug, Clone, Deserialize)]
pub struct ProfileIdBody {
    pub profile_id: String,
}
