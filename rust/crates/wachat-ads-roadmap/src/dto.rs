//! Wire DTOs for the wachat ads-roadmap endpoints.
//!
//! `camelCase` to match the JSON the `/wachat/whatsapp-ads/roadmap` page
//! consumes (phase `slug`/`phase`, `title`, `status`, `milestones[]`,
//! aggregated `voteCount`/`votes`).

use serde::Serialize;
use serde_json::Value;
use utoipa::ToSchema;

/// Response for `GET /phases` — the global roadmap phases as cleaned JSON
/// docs, each enriched with the caller-visible aggregated vote count.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListPhasesResponse {
    #[schema(value_type = Vec<Object>)]
    pub phases: Vec<Value>,
}

/// `{ success: true }` envelope for the vote mutation.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct VoteResponse {
    pub success: bool,
    /// `true` when this call recorded a brand-new vote; `false` when the
    /// caller had already voted (idempotent no-op).
    pub created: bool,
    /// The phase's aggregated vote count after this call.
    pub vote_count: u64,
}

/// `POST /sync` stub response — no external PM is wired, so this never
/// performs a live sync.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SyncResponse {
    pub synced: bool,
    pub reason: String,
}

impl SyncResponse {
    /// The fixed "not configured" stub payload.
    pub fn not_configured() -> Self {
        Self {
            synced: false,
            reason: "external PM not configured".to_owned(),
        }
    }
}
