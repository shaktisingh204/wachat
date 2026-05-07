//! Wire-format DTOs for the CRM deals HTTP surface.
//!
//! These mirror the create / update payloads accepted by
//! `src/app/actions/crm-deals.actions.ts` and the canonical `Deal` shape
//! defined in [`crm_sales_crm_types::deal::Deal`]. Field names are
//! `camelCase` on the wire to match the existing TS callers.
//!
//! The list/get response payloads are intentionally typed as
//! `serde_json::Value` — `Deal` flattens four `crm-core` fragments and
//! evolves with each spec amendment, and we want the wire format to
//! follow the stored Mongo document verbatim (the same `JSON.parse(
//! JSON.stringify(...))` shape the TS code returns today).

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

/// `GET /v1/crm/deals` query params. Page is 1-indexed; the handler
/// clamps `limit` at 100 to bound a single-page round trip.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    /// 1-indexed page number. Defaults to 1 when absent or `<= 0`.
    #[serde(default)]
    pub page: Option<u64>,
    /// Page size. Clamped at 100 by the handler. Defaults to 20.
    #[serde(default)]
    pub limit: Option<u64>,
    /// Optional case-insensitive substring match on `title`. Matches the
    /// TS server action's `query` parameter (renamed `q` here for
    /// brevity / parity with sibling `crm-leads`).
    #[serde(default, alias = "query")]
    pub q: Option<String>,
    /// Restrict to a single sales pipeline.
    #[serde(default)]
    pub pipeline_id: Option<String>,
    /// Restrict to a single stage within the pipeline.
    #[serde(default)]
    pub stage_id: Option<String>,
}

/// Tagged counter-party reference accepted on create / update. Mirrors
/// the `DealParty` enum in `crm-sales-crm-types::deal` — but accepts a
/// hex-string id over the wire (the handler parses to `ObjectId`).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PartyInput {
    /// Either `"client"` or `"lead"`.
    pub kind: String,
    /// Hex-encoded `ObjectId` of the referenced client/lead.
    pub id: String,
}

/// `POST /v1/crm/deals` body. Required fields: `title`, `pipelineId`,
/// `stageId`, `ownerId`, `party`, `amount`, `expectedClose`. Everything
/// else mirrors the optional fields on `Deal`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateDealInput {
    pub title: String,
    pub pipeline_id: String,
    pub stage_id: String,
    pub owner_id: String,
    #[serde(default)]
    pub team_id: Option<String>,

    pub party: PartyInput,

    pub amount: f64,
    #[serde(default)]
    pub currency: Option<String>,
    /// Probability of closing, 0-100 (%).
    #[serde(default)]
    pub probability_pct: Option<f32>,

    pub expected_close: chrono::DateTime<chrono::Utc>,
    #[serde(default)]
    pub actual_close: Option<chrono::DateTime<chrono::Utc>>,

    /// Free-form workflow status — one of `open` / `won` / `lost` /
    /// `abandoned`. Defaults to `open` when absent.
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub won_lost_reason: Option<String>,
    #[serde(default)]
    pub competitors: Option<Vec<String>>,

    /// Free-form `customFields` bag — passed through verbatim.
    #[serde(default)]
    pub custom_fields: Option<Value>,

    /* ----- §13.5 lineage seeding ---------------------------------- */
    /// `"lead"` is the only honoured value today (a deal in §13.5
    /// originates from a Lead). Both lineage fields are optional —
    /// existing create-deal flows keep working unchanged.
    #[serde(default)]
    pub from_kind: Option<String>,
    /// Hex-encoded `ObjectId` of the parent lead.
    #[serde(default)]
    pub from_id: Option<String>,
}

/// `PATCH /v1/crm/deals/:id` body. Every field is optional — only the
/// fields actually present in the JSON body are written. Sending an
/// empty body is a no-op (the handler still bumps `updatedAt`).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateDealInput {
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub pipeline_id: Option<String>,
    #[serde(default)]
    pub stage_id: Option<String>,
    #[serde(default)]
    pub owner_id: Option<String>,
    #[serde(default)]
    pub team_id: Option<String>,

    #[serde(default)]
    pub party: Option<PartyInput>,

    #[serde(default)]
    pub amount: Option<f64>,
    #[serde(default)]
    pub currency: Option<String>,
    #[serde(default)]
    pub probability_pct: Option<f32>,

    #[serde(default)]
    pub expected_close: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(default)]
    pub actual_close: Option<chrono::DateTime<chrono::Utc>>,

    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub won_lost_reason: Option<String>,
    #[serde(default)]
    pub competitors: Option<Vec<String>>,

    #[serde(default)]
    pub custom_fields: Option<Value>,
}

/// Response body for `GET /v1/crm/deals` — paginated list of raw deal
/// documents.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    #[schema(value_type = Vec<Object>)]
    pub deals: Vec<Value>,
    pub total: u64,
    pub page: u64,
    pub limit: u64,
}

/// Response body for `GET /v1/crm/deals/:id` — the raw deal document.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct DealResponse {
    #[schema(value_type = Object)]
    pub deal: Value,
}

/// Response body for `POST /v1/crm/deals` — returns the newly-allocated
/// `_id` so callers can immediately route to detail without a re-list.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateDealResponse {
    pub deal_id: String,
    pub message: String,
}

/// Response body for `PATCH /v1/crm/deals/:id` and `DELETE
/// /v1/crm/deals/:id` — a tiny success envelope mirroring the
/// `{ message }` shape the TS callers expect.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SuccessResponse {
    pub message: String,
}
