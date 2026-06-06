//! Wire DTOs for the ab-testing endpoints. `camelCase` to match the
//! JSON the `/wachat/campaign-ab-test` page sends.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

/// One variant of a split test (the `A` or `B` template). Mirrors the
/// shape the page builds from its template picker.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct VariantInput {
    /// Optional WhatsApp template id (when the page has a real template id).
    #[serde(default)]
    pub template_id: Option<String>,
    /// Human-readable template name shown in the picker.
    pub name: String,
}

/// Body for `POST /` — create + launch a split test.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateTestBody {
    /// Project this test runs under (hex ObjectId).
    pub project_id: String,
    /// Human label for the test.
    pub name: String,
    /// Variant A template.
    pub variant_a: VariantInput,
    /// Variant B template.
    pub variant_b: VariantInput,
    /// Percentage of the audience routed to variant A (10..=90).
    pub split_pct: u32,
    /// Audience/segment selector: `"all"` or a `wa_broadcast_segments` id.
    pub audience: String,
    /// Optional phone-number id the broadcast sends from.
    #[serde(default)]
    pub phone_number_id: Option<String>,
}

/// Query for `GET /` — list tests for one project.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListTestsQuery {
    /// Project to list tests for (hex ObjectId).
    pub project_id: String,
}

/// Body for `POST /{id}/promote-winner`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PromoteWinnerBody {
    /// Winning variant: `"A"` or `"B"`.
    pub winner_variant: String,
}

/// Response for `GET /` — the caller's tests, each enriched with its
/// `status` and a light summary of result metrics.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListTestsResponse {
    #[schema(value_type = Vec<Object>)]
    pub tests: Vec<Value>,
}

/// Response for `GET /{id}` — the full test config plus per-variant
/// computed results (sent/opened/replied/openRate/replyRate).
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct TestDetailResponse {
    #[schema(value_type = Object)]
    pub test: Value,
    pub variants: Vec<VariantResult>,
}

/// Computed per-variant metrics for the detail view.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct VariantResult {
    /// `"A"` or `"B"`.
    pub variant: String,
    pub sent: i64,
    pub opened: i64,
    pub replied: i64,
    /// `opened / sent`, in `0.0..=1.0` (0 when `sent == 0`).
    pub open_rate: f64,
    /// `replied / sent`, in `0.0..=1.0` (0 when `sent == 0`).
    pub reply_rate: f64,
}

/// `{ success: true }` envelope for stop / promote / delete.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct SuccessResponse {
    pub success: bool,
}

impl SuccessResponse {
    pub fn ok() -> Self {
        Self { success: true }
    }
}
