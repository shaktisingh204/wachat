//! Wire-format DTOs for the SabChat AI QA endpoints.
//!
//! Every body / query uses `#[serde(rename_all = "camelCase")]` to
//! match the JSON the Next.js side already speaks. Stored documents
//! are returned as `serde_json::Value` (via `document_to_clean_json`)
//! so we never have to chase a schema change in the wire DTO when the
//! underlying document gains a field.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

use crate::grader::{CriterionScore, RubricCriterion};

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

/// Hard upper bound on `?limit=` for the list endpoints. Mirrors the
/// `sabchat-audit` MAX_LIMIT so the SabChat surface feels uniform.
pub const MAX_LIST_LIMIT: i64 = 100;
/// Default page size when the caller does not supply `?limit=`.
pub const DEFAULT_LIST_LIMIT: i64 = 25;

fn default_list_limit() -> i64 {
    DEFAULT_LIST_LIMIT
}

// ---------------------------------------------------------------------------
// `POST /rubrics`
// ---------------------------------------------------------------------------

/// Body for `POST /rubrics` — create a new rubric under the caller's
/// tenant. `active` defaults to `true` so a freshly-created rubric is
/// immediately gradable.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateRubricBody {
    pub name: String,
    pub criteria: Vec<RubricCriterion>,
    #[serde(default = "default_true")]
    pub active: bool,
}

fn default_true() -> bool {
    true
}

// ---------------------------------------------------------------------------
// `PATCH /rubrics/{id}`
// ---------------------------------------------------------------------------

/// Body for `PATCH /rubrics/{id}` — every field is optional and only
/// the supplied ones are `$set`. Submitting an empty body is allowed
/// (no-op `updatedAt` bump).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateRubricBody {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub criteria: Option<Vec<RubricCriterion>>,
    #[serde(default)]
    pub active: Option<bool>,
}

// ---------------------------------------------------------------------------
// `GET /rubrics`
// ---------------------------------------------------------------------------

/// Query string for `GET /rubrics`. Tenant scope is implicit — the
/// caller cannot list other tenants' rubrics.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListRubricsQuery {
    /// If supplied, restrict to `active == <value>`. Omit to include
    /// both active and archived rubrics.
    #[serde(default)]
    pub active: Option<bool>,
}

/// Response for `GET /rubrics`.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListRubricsResponse {
    #[schema(value_type = Vec<Object>)]
    pub rubrics: Vec<Value>,
}

// ---------------------------------------------------------------------------
// `POST /grade/{conversationId}`
// ---------------------------------------------------------------------------

/// Body for `POST /grade/{conversationId}` — AI auto-grade. The
/// conversation id travels in the path; the rubric id is the only
/// piece the body carries.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct GradeRequest {
    pub rubric_id: String,
}

// ---------------------------------------------------------------------------
// `POST /manual/{conversationId}`
// ---------------------------------------------------------------------------

/// Body for `POST /manual/{conversationId}` — agent-submitted manual
/// score. The agent provides one score per criterion (validated against
/// the rubric); the `coaching` note is optional.
///
/// The grading agent's user id is read off the auth context — we
/// deliberately do **not** accept it on the wire to prevent
/// impersonation.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ManualGradeRequest {
    pub rubric_id: String,
    pub scores: Vec<CriterionScore>,
    #[serde(default)]
    pub coaching: Option<String>,
}

// ---------------------------------------------------------------------------
// Score response (shared by /grade, /manual, /scores/{id})
// ---------------------------------------------------------------------------

/// Persisted-score envelope returned by every grade write and the
/// single-score read. The numeric totals are derived server-side from
/// `scores` × rubric weights so callers cannot tamper with them.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ScoreResponse {
    /// Hex ObjectId of the persisted `sabchat_qa_scores` document.
    pub id: String,
    pub tenant_id: String,
    pub conversation_id: String,
    pub rubric_id: String,
    pub scores: Vec<CriterionScore>,
    /// Sum of `score × weight` across criteria.
    pub total: f32,
    /// Sum of `weight` across criteria — i.e. the highest `total` a
    /// perfect grade could earn. Callers display `total / max` as the
    /// percentage on the leaderboard.
    pub max: f32,
    #[serde(default)]
    pub coaching: Option<String>,
    /// `"ai"` for [`crate::handlers::grade_conversation`] and
    /// `"agent"` for [`crate::handlers::manual_grade_conversation`].
    pub graded_by: String,
    /// RFC 3339 timestamp.
    pub graded_at: String,
    /// Denormalised agent id (the conversation's assignee at write
    /// time, or the manually-grading agent's id on the manual path).
    /// Surfaced so the leaderboard query can group without an extra
    /// `$lookup` into `sabchat_conversations`.
    #[serde(default)]
    pub agent_id: Option<String>,
}

// ---------------------------------------------------------------------------
// `GET /scores`
// ---------------------------------------------------------------------------

/// Query string for `GET /scores`. Every filter is optional; tenant
/// scope is implicit. Pagination is cursor-style on the `_id` index
/// (newest-first) so the cost stays O(limit).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListScoresQuery {
    #[serde(default)]
    pub conversation_id: Option<String>,
    #[serde(default)]
    pub rubric_id: Option<String>,
    #[serde(default)]
    pub agent_id: Option<String>,
    /// RFC 3339 lower bound on `gradedAt` (`>=`).
    #[serde(default)]
    pub from: Option<String>,
    /// RFC 3339 upper bound on `gradedAt` (`<`).
    #[serde(default)]
    pub to: Option<String>,
    /// Page size — clamped into `[1, MAX_LIST_LIMIT]`.
    #[serde(default = "default_list_limit")]
    pub limit: i64,
    /// Hex `_id` of the last score from the previous page. Pass back
    /// the `nextCursor` from a prior response to fetch the next page.
    #[serde(default)]
    pub cursor: Option<String>,
}

/// Response for `GET /scores`. `nextCursor` is `None` once the listing
/// reaches the end.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListScoresResponse {
    #[schema(value_type = Vec<Object>)]
    pub scores: Vec<Value>,
    #[serde(default)]
    pub next_cursor: Option<String>,
}

// ---------------------------------------------------------------------------
// `GET /leaderboard`
// ---------------------------------------------------------------------------

/// Query string for `GET /leaderboard` — mean total score per agent,
/// optionally restricted to one rubric and / or a date range.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct LeaderboardQuery {
    #[serde(default)]
    pub rubric_id: Option<String>,
    #[serde(default)]
    pub from: Option<String>,
    #[serde(default)]
    pub to: Option<String>,
}

/// One row of the leaderboard.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct LeaderboardEntry {
    /// Hex ObjectId of the agent. `None` for ungraded / unassigned
    /// conversations — those are bucketed into a single "unassigned"
    /// row so the totals stay accurate.
    #[serde(default)]
    pub agent_id: Option<String>,
    /// Number of `sabchat_qa_scores` documents that contributed to
    /// `meanTotal`.
    pub count: u64,
    /// Mean of `total` across the contributing documents.
    pub mean_total: f32,
    /// Mean of `max` across the contributing documents — the
    /// achievable ceiling for the same set of grades. UIs use
    /// `meanTotal / meanMax` as the displayed percentage.
    pub mean_max: f32,
}

/// Response for `GET /leaderboard`. Rows are sorted by `meanTotal`
/// descending — best agent first.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct LeaderboardResponse {
    pub entries: Vec<LeaderboardEntry>,
}

// ---------------------------------------------------------------------------
// Generic success envelope
// ---------------------------------------------------------------------------

/// `{ success: true }` shape returned by DELETE / no-payload endpoints.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct SuccessResponse {
    pub success: bool,
}

impl SuccessResponse {
    pub fn ok() -> Self {
        Self { success: true }
    }
}

/// Single-document `GET` response. Wrapped instead of returning the raw
/// `Value` so we can add envelope fields in a follow-up without an
/// OpenAPI break.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct DocResponse {
    #[schema(value_type = Object)]
    pub doc: Value,
}
