//! Wire-format DTOs for the SabChat CSAT / NPS / CES endpoints.
//!
//! Each shape mirrors a single handler in [`crate::handlers`] or
//! [`crate::public_handlers`]. All request bodies / queries use
//! `rename_all = "camelCase"` so the JSON sent by the Next.js side
//! round-trips cleanly.
//!
//! Stored documents are returned as `serde_json::Value` (rendered via
//! `document_to_clean_json`) so the router stays out of the way when
//! callers evolve the document shape.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

// ---------------------------------------------------------------------------
// Pagination defaults
// ---------------------------------------------------------------------------

/// Default page size for response listings. Matches sibling crates.
pub const DEFAULT_LIMIT: i64 = 50;

/// Hard ceiling — protects against pathological large pages.
pub const MAX_LIMIT: i64 = 200;

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/// Survey kind — one of the three industry-standard customer-satisfaction
/// instruments. The scale is intentionally not pinned here (a CSAT can
/// be 1-5 or 1-10, an NPS is always 0-10, a CES is typically 1-7); the
/// `scale_min` / `scale_max` fields on the survey definition carry that.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum SurveyKind {
    /// Customer satisfaction.
    Csat,
    /// Net Promoter Score.
    Nps,
    /// Customer Effort Score.
    Ces,
}

/// When the survey should fire. `on_resolve` lets the conversations crate
/// auto-send the survey when a conversation transitions to `resolved`;
/// `manual` means an agent must call `POST /send/{conversationId}`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum SurveyTrigger {
    OnResolve,
    Manual,
}

// ---------------------------------------------------------------------------
// POST /surveys — create_survey
// ---------------------------------------------------------------------------

/// Body for `POST /v1/sabchat/csat/surveys`. All fields except
/// `follow_up_question` are required.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateSurveyBody {
    /// Human-readable survey name (shown in the agent UI).
    pub name: String,
    /// Survey kind — CSAT / NPS / CES.
    pub kind: SurveyKind,
    /// Inclusive lower bound of the numeric scale.
    pub scale_min: i32,
    /// Inclusive upper bound of the numeric scale.
    pub scale_max: i32,
    /// Question text shown next to the score selector.
    pub question: String,
    /// Optional open-text follow-up shown below the score selector.
    #[serde(default)]
    pub follow_up_question: Option<String>,
    /// Trigger — defaults to [`SurveyTrigger::Manual`] when omitted.
    #[serde(default)]
    pub trigger: Option<SurveyTrigger>,
    /// Whether the survey is currently usable. Defaults to `true`.
    #[serde(default)]
    pub active: Option<bool>,
}

// ---------------------------------------------------------------------------
// GET /surveys — list_surveys
// ---------------------------------------------------------------------------

/// Query string for `GET /v1/sabchat/csat/surveys`. Both filters are
/// optional; omitting them returns every survey owned by the calling
/// tenant.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListSurveysQuery {
    /// Restrict to one kind (CSAT / NPS / CES).
    #[serde(default)]
    pub kind: Option<SurveyKind>,
    /// Restrict to active / inactive surveys.
    #[serde(default)]
    pub active: Option<bool>,
}

/// Response envelope for `GET /v1/sabchat/csat/surveys`.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListSurveysResponse {
    #[schema(value_type = Vec<Object>)]
    pub surveys: Vec<Value>,
}

// ---------------------------------------------------------------------------
// GET / PATCH /surveys/{id}
// ---------------------------------------------------------------------------

/// Response envelope for the single-survey endpoints — `GET /surveys/{id}`,
/// `PATCH /surveys/{id}`, `POST /surveys`.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SurveyResponse {
    #[schema(value_type = Object)]
    pub survey: Value,
}

/// Body for `PATCH /v1/sabchat/csat/surveys/{id}`. Every field is
/// optional — only the keys that are present in the JSON are `$set`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSurveyBody {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub kind: Option<SurveyKind>,
    #[serde(default)]
    pub scale_min: Option<i32>,
    #[serde(default)]
    pub scale_max: Option<i32>,
    #[serde(default)]
    pub question: Option<String>,
    #[serde(default)]
    pub follow_up_question: Option<String>,
    #[serde(default)]
    pub trigger: Option<SurveyTrigger>,
    #[serde(default)]
    pub active: Option<bool>,
}

// ---------------------------------------------------------------------------
// POST /send/{conversationId} — send_survey
// ---------------------------------------------------------------------------

/// Body for `POST /v1/sabchat/csat/send/{conversationId}`. Carries only
/// the survey id — the conversation comes from the path.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SendSurveyBody {
    /// Hex `ObjectId` of the survey definition to send.
    pub survey_id: String,
}

/// Response envelope for `POST /send/{conversationId}` — echoes the
/// freshly-inserted outbound message id so the caller can correlate it
/// with the conversation log if needed.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SendSurveyResponse {
    /// Hex `ObjectId` of the new `sabchat_messages` row.
    pub message_id: String,
    /// Hex `ObjectId` of the survey we sent.
    pub survey_id: String,
}

// ---------------------------------------------------------------------------
// GET /responses — list_responses
// ---------------------------------------------------------------------------

/// Query string for `GET /v1/sabchat/csat/responses`. All filters are
/// optional and AND-combined. Pagination is cursor-based; `cursor` is
/// the hex `_id` of the last document returned (sort: `submittedAt
/// desc, _id desc`).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListResponsesQuery {
    #[serde(default)]
    pub survey_id: Option<String>,
    #[serde(default)]
    pub conversation_id: Option<String>,
    #[serde(default)]
    pub limit: Option<i64>,
    #[serde(default)]
    pub cursor: Option<String>,
}

/// Response envelope for `GET /v1/sabchat/csat/responses`.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListResponsesResponse {
    #[schema(value_type = Vec<Object>)]
    pub responses: Vec<Value>,
    #[serde(default)]
    pub next_cursor: Option<String>,
}

// ---------------------------------------------------------------------------
// GET /stats — survey_stats
// ---------------------------------------------------------------------------

/// Query string for `GET /v1/sabchat/csat/stats`. `survey_id` is
/// required; `from` / `to` are optional RFC3339 timestamps that bound
/// `submittedAt`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct StatsQuery {
    pub survey_id: String,
    #[serde(default)]
    pub from: Option<String>,
    #[serde(default)]
    pub to: Option<String>,
}

/// Aggregate stats for one survey over an optional time window.
///
/// - `count` — total number of responses in the window.
/// - `mean`  — arithmetic mean score (None when `count == 0`).
/// - `distribution` — `{ score → count }` histogram, keyed by the
///   string form of the integer score so the JSON keys round-trip
///   cleanly without special casing.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct StatsResponse {
    pub count: u64,
    #[serde(default)]
    pub mean: Option<f64>,
    pub distribution: serde_json::Map<String, Value>,
}

// ---------------------------------------------------------------------------
// POST /respond  (public widget)
// ---------------------------------------------------------------------------

/// Body for `POST /v1/sabchat/csat-public/respond`. The widget proves
/// identity with `visitorToken`; the survey id is recovered from the
/// conversation's `customAttrs.pendingSurveyId` stash set by
/// `send_survey`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PublicRespondBody {
    /// Opaque session token issued by `sabchat-widget`. Looked up in the
    /// `sabchat_widget_sessions` collection — that row carries the
    /// tenant, inbox, contact, and conversation ids.
    pub visitor_token: String,
    /// The numeric score the visitor selected.
    pub score: i32,
    /// Optional open-text follow-up answer.
    #[serde(default)]
    pub follow_up_answer: Option<String>,
}

/// Response envelope for the public submission endpoint. We surface the
/// new row's hex id so the widget can show a thank-you state keyed on
/// successful persistence.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PublicRespondResponse {
    pub response_id: String,
}

// ---------------------------------------------------------------------------
// Generic success envelope
// ---------------------------------------------------------------------------

/// `{ success: true }` shape returned by `DELETE /surveys/{id}`.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct SuccessResponse {
    pub success: bool,
}

impl SuccessResponse {
    pub fn ok() -> Self {
        Self { success: true }
    }
}
