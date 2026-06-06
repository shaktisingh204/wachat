//! Wire DTOs for the quality-history endpoints. `camelCase` to match the
//! JSON the `/wachat/health` page consumes (date / rating / event).

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

/// Body for `POST /{phoneNumberId}/snapshot` — record one quality reading.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotBody {
    /// Quality rating label at this point in time: `"GREEN" | "YELLOW" | "RED"`.
    pub rating: String,
    /// Optional event/annotation that explains a change (e.g. a campaign name).
    /// `None`/empty stores `null`.
    #[serde(default)]
    pub event: Option<String>,
}

/// Response for `GET /{phoneNumberId}` — the caller's snapshots as cleaned
/// JSON docs, sorted by `date` ascending. Empty array when there are none
/// (honest empty state — never mocked).
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListSnapshotsResponse {
    #[schema(value_type = Vec<Object>)]
    pub snapshots: Vec<Value>,
}

/// `{ success: true }` envelope for the snapshot mutation.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct SuccessResponse {
    pub success: bool,
}

impl SuccessResponse {
    pub fn ok() -> Self {
        Self { success: true }
    }
}
