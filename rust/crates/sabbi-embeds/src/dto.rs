//! Request DTOs for bi-embeds.

use serde::{Deserialize, Serialize};

use crate::types::BiEmbed;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub workbook_id: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateEmbedInput {
    pub workbook_id: String,
    /// Optional ISO timestamp; omit for non-expiring.
    #[serde(default)]
    pub expires_at: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(default)]
    pub allow_origins: Vec<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateEmbedInput {
    #[serde(default)]
    pub expires_at: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(default)]
    pub allow_origins: Option<Vec<String>>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateEmbedResponse {
    pub id: String,
    pub entity: BiEmbed,
    /// Convenience: precomputed public URL fragment (`/embed/bi/<token>`).
    pub public_path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteEmbedResponse {
    pub deleted: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedEmbed {
    /// Minimal workbook payload — id + name + chart configs that the
    /// public renderer needs. We deliberately omit ownership / audit fields.
    pub workbook_id: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub charts: Vec<bson::Document>,
    pub allow_origins: Vec<String>,
}
