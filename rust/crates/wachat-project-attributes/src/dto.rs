//! Wire DTOs for the wachat project-attributes endpoints. `camelCase` to
//! match the JSON the `/wachat/settings/attributes` page sends.
//!
//! A *user attribute* is an embedded record on the `projects` document
//! (`projects.userAttributes[]`). The shape mirrors the one authored by
//! `UserAttributesSettingsTab` / `handleSaveUserAttributes`:
//!
//! ```text
//! { id, name, dataType: 'TEXT'|'NUMBER'|'BOOLEAN'|'DATE',
//!   webhookKey?, status: 'ACTIVE'|'INACTIVE' }
//! ```

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

/// A single custom user attribute as stored in `projects.userAttributes[]`.
///
/// `id` is a client-minted stable key (uuid in the legacy UI). It is
/// optional on the wire — the handler back-fills a fresh value when the
/// client omits it (e.g. a freshly added row).
#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UserAttribute {
    /// Stable client key for this attribute row.
    #[serde(default)]
    pub id: Option<String>,
    /// Human label, e.g. "Membership Level". Required, non-empty.
    pub name: String,
    /// One of `TEXT` | `NUMBER` | `BOOLEAN` | `DATE`. Required.
    pub data_type: String,
    /// Optional inbound webhook mapping key (e.g. `custom_field_1`).
    #[serde(default)]
    pub webhook_key: Option<String>,
    /// `ACTIVE` | `INACTIVE`. Required.
    pub status: String,
}

/// Body for `PATCH /projects/{id}/attributes` — the full replacement set.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ReplaceAttributesBody {
    /// The complete new list of attributes (replaces the stored array).
    #[serde(default)]
    pub attributes: Vec<UserAttribute>,
}

/// Response for `GET /projects/{id}/attributes` — the stored attributes
/// as cleaned JSON values (passthrough so any extra legacy fields the
/// client wrote survive a round trip).
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListAttributesResponse {
    #[schema(value_type = Vec<Object>)]
    pub attributes: Vec<Value>,
}

/// `{ success: true }` envelope for the PATCH mutation.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct SuccessResponse {
    pub success: bool,
}

impl SuccessResponse {
    pub fn ok() -> Self {
        Self { success: true }
    }
}
