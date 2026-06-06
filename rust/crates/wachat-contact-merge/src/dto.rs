//! Wire DTOs for the wachat contact-merge endpoint. `camelCase` to match
//! the JSON the `/wachat/contact-merge` page sends.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

/// Body for `POST /v1/wachat/contact-merge`.
///
/// Merges the `secondaryId` contact into the `primaryId` contact within a
/// single project: the primary survives (winning non-null fields), every
/// message/conversation FK is re-pointed, and the secondary is deleted.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct MergeBody {
    /// Project the two contacts belong to. Both must be scoped to it.
    pub project_id: String,
    /// The surviving contact's id (hex `ObjectId`). Wins field conflicts.
    pub primary_id: String,
    /// The contact to fold in and then delete (hex `ObjectId`).
    pub secondary_id: String,
}

/// Response for `POST /` — the updated primary contact as cleaned JSON
/// plus a count of re-pointed message rows for observability.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct MergeResponse {
    /// Always `true` on success (the error path returns a non-2xx body).
    pub success: bool,
    /// The merged primary contact, ObjectId→hex / dates→ISO normalised.
    #[schema(value_type = Object)]
    pub contact: Value,
    /// Number of `incoming_messages` rows re-pointed to the primary.
    pub incoming_repointed: u64,
    /// Number of `outgoing_messages` rows re-pointed to the primary.
    pub outgoing_repointed: u64,
    /// Number of stale `conversations` rows removed for the secondary.
    pub conversations_removed: u64,
}
