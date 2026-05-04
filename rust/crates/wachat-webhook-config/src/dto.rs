//! Wire-format DTOs for the webhook-admin endpoints.
//!
//! These types are the **public contract** with the Next.js TypeScript
//! client. Field names use `serde(rename_all = "camelCase")` to match the
//! TS conventions (`projectId`, `receivedAt`, `nextCursor`, ...) without
//! forcing the Rust side to use camelCase identifiers.
//!
//! Keep these decoupled from the Mongo document shape — handlers do the
//! conversion. That gives us room to evolve storage without breaking the
//! API.

use serde::{Deserialize, Serialize};

/// Query string for `GET /admin/logs`.
///
/// All fields are optional. The handler clamps `limit` to
/// `[1, MAX_LIST_LIMIT]` and falls back to `DEFAULT_LIST_LIMIT` when absent.
///
/// Pagination is **timestamp-based**: `cursor` is the ISO-8601
/// `received_at` of the last item in the previous page. The next page
/// returns logs strictly older than that timestamp, so callers can scroll
/// monotonically backwards in time.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListLogsQuery {
    /// Filter by project (Mongo ObjectId hex). Omit for cross-project view
    /// (admin only — the auth check is enforced in the handler).
    pub project_id: Option<String>,
    /// Filter by log status, e.g. `"processed"`, `"pending"`,
    /// `"pending_reprocess"`, `"failed"`.
    pub status: Option<String>,
    /// Inclusive lower bound on `received_at`, as **unix milliseconds**.
    pub start: Option<i64>,
    /// Inclusive upper bound on `received_at`, as **unix milliseconds**.
    pub end: Option<i64>,
    /// Page size. Clamped to `[1, MAX_LIST_LIMIT]`; defaults to
    /// `DEFAULT_LIST_LIMIT` when absent.
    pub limit: Option<i64>,
    /// Opaque continuation token from the previous response's
    /// `next_cursor`. Currently the ISO-8601 `received_at` of the last
    /// returned item.
    pub cursor: Option<String>,
}

/// Compact list-row representation for `GET /admin/logs`.
///
/// Intentionally omits the (potentially large) raw `payload` — clients
/// fetch that on demand via `GET /admin/logs/{id}/payload`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WebhookLogSummary {
    /// Mongo `_id`, hex-encoded.
    pub id: String,
    /// Owning project id, hex-encoded. May be empty if the log was
    /// captured before a project lookup succeeded.
    pub project_id: String,
    /// `entry[0].changes[0].field` — e.g. `"messages"`, `"templates"`.
    pub field: String,
    /// Lifecycle state — `"pending"`, `"processed"`, `"failed"`,
    /// `"pending_reprocess"`.
    pub status: String,
    /// When the webhook hit the receiver, in UTC.
    pub received_at: chrono::DateTime<chrono::Utc>,
    /// Last error message captured during processing, if any.
    pub error: Option<String>,
}

/// Response body for `GET /admin/logs`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListLogsResp {
    /// Page of summaries, newest first.
    pub logs: Vec<WebhookLogSummary>,
    /// Pass back as `cursor` on the next request to fetch the next page.
    /// `None` indicates the last page.
    pub next_cursor: Option<String>,
}

/// Response body for `POST /admin/logs/{id}/reprocess`.
///
/// `ok = true` means the log was found and marked `pending_reprocess`.
/// The actual replay through the receiver dispatcher is a TODO — see the
/// handler comment.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReprocessResp {
    pub ok: bool,
    pub log_id: String,
}

/// Response body for `POST /admin/logs/clear`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClearResp {
    /// Number of `webhook_logs` documents removed by the bulk delete.
    pub deleted: i64,
}
