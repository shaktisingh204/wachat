//! Wire-format DTOs for the SabChat gamification endpoints.
//!
//! Mirrors the JSON the Next.js side sends — every body / query uses
//! `#[serde(rename_all = "camelCase")]`. Stored documents are returned
//! as `serde_json::Value` where the shape is intentionally opaque
//! (badges have a free-form criteria payload), and as typed structs
//! where the leaderboard / stats response shape is part of the API
//! contract.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/// Default leaderboard page size when the caller omits `limit`. Mirrors
/// the legacy TS limit so dashboard pagination doesn't shift.
pub const DEFAULT_LEADERBOARD_LIMIT: i64 = 50;

/// Hard cap so a runaway `limit` cannot pull the whole tenant's roster.
pub const MAX_LEADERBOARD_LIMIT: i64 = 500;

// ---------------------------------------------------------------------------
// Period enum
// ---------------------------------------------------------------------------

/// Leaderboard / stats period. The wire form uses snake_case
/// (`all_time`, `month`, `week`) — matches the `period` field on the
/// `sabchat_agent_points` document.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize, ToSchema, Default)]
#[serde(rename_all = "snake_case")]
pub enum Period {
    #[default]
    AllTime,
    Month,
    Week,
}

impl Period {
    /// The wire / Mongo `period` field for this variant.
    pub fn as_wire(&self) -> &'static str {
        match self {
            Period::AllTime => "all_time",
            Period::Month => "month",
            Period::Week => "week",
        }
    }
}

// ---------------------------------------------------------------------------
// Badge CRUD
// ---------------------------------------------------------------------------

/// Kind of award criteria. Matches the `criteria.kind` enum stored on
/// `sabchat_badges`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum CriteriaKind {
    ResolvedCount,
    CsatScore,
    StreakDays,
}

/// Free-form badge criteria. Threshold is stored as `i64` so the
/// `resolved_count` ceiling (e.g. 1000 resolutions) and `streak_days`
/// (e.g. 30 days) both fit naturally; CSAT thresholds (1..=5) round-trip
/// fine too.
#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct BadgeCriteria {
    pub kind: CriteriaKind,
    pub threshold: i64,
}

/// Body for `POST /v1/sabchat/gamification/badges`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateBadgeBody {
    /// Short stable identifier — used by `POST /award`. Tenant-unique.
    pub code: String,
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    /// Icon hint (emoji, SabFiles file id, or a URL — we store as-is).
    #[serde(default)]
    pub icon: Option<String>,
    pub criteria: BadgeCriteria,
}

/// Body for `PATCH /v1/sabchat/gamification/badges/{id}`.
///
/// Every field is optional — only the provided fields are `$set`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateBadgeBody {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub icon: Option<String>,
    #[serde(default)]
    pub criteria: Option<BadgeCriteria>,
}

/// Response envelope wrapping a single stored badge document.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct BadgeResponse {
    #[schema(value_type = Object)]
    pub badge: Value,
}

/// Response envelope wrapping a list of stored badge documents.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListBadgesResponse {
    #[schema(value_type = Vec<Object>)]
    pub badges: Vec<Value>,
}

// ---------------------------------------------------------------------------
// POST /award
// ---------------------------------------------------------------------------

/// Body for `POST /v1/sabchat/gamification/award`. Identifies a badge
/// by its tenant-unique `code` (not `_id`) so external automations can
/// award without round-tripping the badge catalogue first.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AwardBadgeBody {
    pub agent_id: String,
    pub badge_code: String,
}

/// Response shape for `POST /award`. `created` is `true` on first
/// award, `false` when the agent already had the badge (idempotent).
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AwardBadgeResponse {
    pub created: bool,
    /// Hex `ObjectId` of the resulting `sabchat_agent_badges` row.
    pub id: String,
}

// ---------------------------------------------------------------------------
// GET /leaderboard
// ---------------------------------------------------------------------------

/// Query string for `GET /v1/sabchat/gamification/leaderboard`. The
/// `since` parameter is currently advisory — the leaderboard is keyed
/// by `period_key` (`week` / `month` / `all`) so a caller asking for
/// "last 30 days" should ask for the `month` period. Reserved for
/// future custom-window support.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct LeaderboardQuery {
    #[serde(default)]
    pub period: Option<Period>,
    #[serde(default)]
    pub limit: Option<i64>,
    /// RFC 3339 timestamp — accepted for forwards compatibility, ignored
    /// today.
    #[serde(default)]
    pub since: Option<String>,
}

/// One row in the leaderboard response.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct LeaderboardRow {
    pub agent_id: String,
    pub points: i64,
    pub conversations_resolved: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub csat_avg: Option<f64>,
    pub rank: i64,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct LeaderboardResponse {
    pub period: Period,
    pub period_key: String,
    pub rows: Vec<LeaderboardRow>,
}

// ---------------------------------------------------------------------------
// GET /agents/{agentId}/badges
// ---------------------------------------------------------------------------

/// One row in the agent-badge list. Mirrors the `sabchat_agent_badges`
/// document shape but with the `awarded_at` rendered as an ISO 8601
/// string (the document-to-clean-json path handles BSON Date → string).
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AgentBadgeRow {
    pub code: String,
    /// ISO 8601 string. Optional because legacy rows may lack the field;
    /// returned `None` in that case rather than failing the read.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub awarded_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AgentBadgesResponse {
    pub agent_id: String,
    pub badges: Vec<AgentBadgeRow>,
}

// ---------------------------------------------------------------------------
// GET /agents/{agentId}/stats
// ---------------------------------------------------------------------------

/// Query for `GET /agents/{agentId}/stats?period=`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AgentStatsQuery {
    #[serde(default)]
    pub period: Option<Period>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AgentStatsResponse {
    pub agent_id: String,
    pub period: Period,
    pub period_key: String,
    pub points: i64,
    pub conversations_resolved: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub csat_avg: Option<f64>,
    pub badges: Vec<AgentBadgeRow>,
}

// ---------------------------------------------------------------------------
// POST /recompute
// ---------------------------------------------------------------------------

/// Body for `POST /v1/sabchat/gamification/recompute`. Currently empty
/// — accepted as a JSON object so the schema can evolve without an API
/// break. `serde(default)` lets the caller send `{}` or omit the body
/// entirely.
#[derive(Debug, Clone, Default, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase", default)]
pub struct RecomputeBody {}

/// Response envelope for `POST /recompute`. Reports how many resolved
/// conversations were scanned and how many leaderboard rows were
/// upserted across the three periods (week / month / all-time).
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RecomputeResponse {
    pub scanned: i64,
    pub updated_rows: i64,
}

// ---------------------------------------------------------------------------
// Generic envelopes
// ---------------------------------------------------------------------------

/// `{ success: true }` shape returned by PATCH / DELETE endpoints.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct SuccessResponse {
    pub success: bool,
}

impl SuccessResponse {
    pub fn ok() -> Self {
        Self { success: true }
    }
}
