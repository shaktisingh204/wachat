//! Wire-format DTOs for the SabChat reports endpoints.
//!
//! Mirrors the read-only HTTP surface this crate exposes:
//!
//! | Route                  | Query / response                                |
//! |------------------------|-------------------------------------------------|
//! | `GET /live`            | (no query)            → [`LiveResponse`]        |
//! | `GET /volume`          | [`VolumeQuery`]       → [`VolumeResponse`]      |
//! | `GET /response-times`  | [`WindowQuery`]       → [`ResponseTimesResponse`] |
//! | `GET /by-agent`        | [`WindowQuery`]       → [`ByAgentResponse`]     |
//! | `GET /by-inbox`        | [`WindowQuery`]       → [`ByInboxResponse`]     |
//! | `GET /by-channel`      | [`WindowQuery`]       → [`ByChannelResponse`]   |
//! | `GET /csat`            | [`WindowQuery`]       → [`CsatResponse`]        |
//!
//! All numeric outputs are `f64` so percentile + average calculations
//! can carry fractional values cleanly. Times are reported in **minutes**.

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

// ---------------------------------------------------------------------------
// Limits / defaults
// ---------------------------------------------------------------------------

/// Maximum number of buckets returned by `GET /volume`. A misconfigured
/// `groupBy=hour` over a 1-year window would otherwise stream ~8.7k
/// buckets per response.
pub const MAX_VOLUME_BUCKETS: usize = 500;

/// Default report window when `from` / `to` are omitted (in days).
pub const DEFAULT_WINDOW_DAYS: i64 = 7;

// ---------------------------------------------------------------------------
// Shared query — `?from=&to=`
// ---------------------------------------------------------------------------

/// Reusable window query. `from` and `to` are RFC 3339 strings (e.g.
/// `2026-05-27T12:00:00Z`); both are optional and default to the last
/// [`DEFAULT_WINDOW_DAYS`] days. The interval is half-open: `from` is
/// inclusive, `to` is exclusive — matches the convention used by
/// `sabchat-audit`.
#[derive(Debug, Clone, Default, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct WindowQuery {
    #[serde(default)]
    pub from: Option<String>,
    #[serde(default)]
    pub to: Option<String>,
}

// ---------------------------------------------------------------------------
// GET /live — LiveResponse
// ---------------------------------------------------------------------------

/// Live queue snapshot. Computed via a single aggregation over
/// `sabchat_conversations` keyed by tenant.
///
/// * `openCount` — conversations in status `open`
/// * `pendingCount` — conversations in status `pending`
/// * `snoozedCount` — conversations in status `snoozed`
/// * `slaBreachedCount` — conversations with `sla.breached == true`
///   (status open / pending only — resolved conversations are excluded
///   even if their cached breach flag is true)
/// * `longestWaitMinutes` — the largest `now - createdAt` (in minutes)
///   across open / pending conversations
/// * `queueByInbox` — count per inbox, joined to the inbox name
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct LiveResponse {
    pub open_count: i64,
    pub pending_count: i64,
    pub snoozed_count: i64,
    pub sla_breached_count: i64,
    pub longest_wait_minutes: f64,
    pub queue_by_inbox: Vec<InboxQueueEntry>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct InboxQueueEntry {
    pub inbox_id: String,
    pub name: String,
    pub count: i64,
}

// ---------------------------------------------------------------------------
// GET /volume — VolumeQuery / VolumeResponse
// ---------------------------------------------------------------------------

/// Granularity for `/volume` buckets. Wire form is lowercase
/// (`hour` | `day` | `week`) — invalid values fall back to `day`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum VolumeGroupBy {
    Hour,
    Day,
    Week,
}

impl Default for VolumeGroupBy {
    fn default() -> Self {
        VolumeGroupBy::Day
    }
}

/// Query string for `GET /volume`. `from` / `to` follow the
/// [`WindowQuery`] convention; `groupBy` defaults to `day`.
#[derive(Debug, Clone, Default, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct VolumeQuery {
    #[serde(default)]
    pub from: Option<String>,
    #[serde(default)]
    pub to: Option<String>,
    #[serde(default)]
    pub group_by: Option<VolumeGroupBy>,
}

/// Response body for `GET /volume`. Each bucket carries the bucket
/// start timestamp (`at`, RFC 3339) plus the conversation count and
/// message count that fell into it.
///
/// Buckets are sorted ascending by `at` and capped at
/// [`MAX_VOLUME_BUCKETS`] — when the cap kicks in the response only
/// contains the most recent buckets so dashboards still show "now".
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct VolumeResponse {
    pub buckets: Vec<VolumeBucket>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct VolumeBucket {
    pub at: String,
    pub conversations: i64,
    pub messages: i64,
}

// ---------------------------------------------------------------------------
// GET /response-times — ResponseTimesResponse
// ---------------------------------------------------------------------------

/// First-response latency percentiles in **minutes**. Computed over
/// conversations with both `createdAt` and `firstResponseAt` set whose
/// `createdAt` falls inside the window.
///
/// When the window contains no qualifying conversations the percentile
/// fields are zero (and `count == 0`) — callers should branch on
/// `count` rather than treating zero as a real datapoint.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ResponseTimesResponse {
    pub count: i64,
    pub mean: f64,
    pub p50: f64,
    pub p95: f64,
    pub p99: f64,
}

// ---------------------------------------------------------------------------
// GET /by-agent — ByAgentResponse
// ---------------------------------------------------------------------------

/// Per-agent breakdown. `conversationsHandled` counts the distinct
/// conversations the agent was assigned to at any point in the window
/// (via `sabchat_assignments.newAssigneeId`).
///
/// `avgFirstResponseMin` is computed over conversations where the agent
/// is the **current** assignee on `sabchat_conversations` — it is not
/// re-derived per assignment row, because the audit trail does not
/// carry latency.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ByAgentResponse {
    pub agents: Vec<AgentBreakdown>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AgentBreakdown {
    pub agent_id: String,
    pub conversations_handled: i64,
    pub avg_first_response_min: f64,
    pub resolved_count: i64,
    pub open_count: i64,
}

// ---------------------------------------------------------------------------
// GET /by-inbox — ByInboxResponse
// ---------------------------------------------------------------------------

/// Per-inbox breakdown. Joins `sabchat_conversations` with
/// `sabchat_inboxes` for the name + channelType labels and pulls the
/// message count from `sabchat_messages`.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ByInboxResponse {
    pub inboxes: Vec<InboxBreakdown>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct InboxBreakdown {
    pub inbox_id: String,
    pub name: String,
    pub channel_type: String,
    pub conversations_created: i64,
    pub messages_sent: i64,
    pub avg_first_response_min: f64,
    pub resolved_count: i64,
}

// ---------------------------------------------------------------------------
// GET /by-channel — ByChannelResponse
// ---------------------------------------------------------------------------

/// Roll-up of `/by-inbox` keyed by `channelType`. Numbers are summed
/// across inboxes; `avgFirstResponseMin` is a conversation-count-
/// weighted average so the channel-level number stays consistent with
/// the underlying inbox-level numbers.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ByChannelResponse {
    pub channels: Vec<ChannelBreakdown>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ChannelBreakdown {
    pub channel_type: String,
    pub conversations_created: i64,
    pub messages_sent: i64,
    pub avg_first_response_min: f64,
    pub resolved_count: i64,
}

// ---------------------------------------------------------------------------
// GET /csat — CsatResponse
// ---------------------------------------------------------------------------

/// CSAT roll-up. Reads `customAttrs.csat: { score, max, submittedAt }`
/// from `sabchat_conversations`. Only conversations whose
/// `customAttrs.csat.submittedAt` falls inside the window are counted.
///
/// `distribution` is a histogram keyed by the raw `score` value cast to
/// `i64`; absent / empty buckets are omitted. When no qualifying
/// conversations exist the response is `{ count: 0, mean: 0.0,
/// distribution: [] }`.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CsatResponse {
    pub count: i64,
    pub mean: f64,
    pub distribution: Vec<CsatBucket>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CsatBucket {
    pub score: i64,
    pub count: i64,
}
