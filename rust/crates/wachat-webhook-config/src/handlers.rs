//! HTTP handlers for the webhook-admin endpoints.
//!
//! Conventions:
//! - Handlers return `Result<Json<T>, ApiError>`. The `ApiError`
//!   `IntoResponse` impl in `sabnode-common` renders a uniform
//!   `{ ok: false, error: ... }` envelope, so handlers never need to
//!   format error bodies themselves.
//! - The Mongo collection name is `WEBHOOK_LOGS_COLLECTION` (`webhook_logs`),
//!   matching the Next.js side.
//! - The wire schema is the contract defined in `crate::dto`. Handlers do
//!   the conversion from the underlying `bson::Document` so storage shape
//!   can evolve independently.
//!
//! ## Document shape (read from `webhook_logs`)
//!
//! Mirrors the TypeScript writer (see `webhook.actions.ts`,
//! `WebhookLog` in `src/lib/definitions.ts`). The fields read here:
//!
//! | BSON key                                | Used as                    |
//! |-----------------------------------------|----------------------------|
//! | `_id`                                   | `WebhookLogSummary.id`     |
//! | `projectId` (ObjectId)                  | `project_id`               |
//! | `payload` (Document)                    | raw payload + field probe  |
//! | `payload.entry.0.changes.0.field`       | `WebhookLogSummary.field`  |
//! | `status` (string) **or** `processed`    | `status` (see comment)     |
//! | `error`  (nullable string)              | `error`                    |
//! | `receivedAt` (DateTime) *or* `createdAt`| `received_at`              |
//!
//! On the **write** path we standardise on the slice-contract names
//! (`status`, `receivedAt`); on read we accept both so this crate stays
//! compatible with documents written by the legacy TS code path.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, DateTime as BsonDateTime, Document, doc};
use chrono::{DateTime, TimeZone, Utc};
use mongodb::options::{FindOneOptions, FindOptions};
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};

use crate::{
    DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT, WEBHOOK_LOGS_COLLECTION, auth_check,
    dto::{ClearResp, ListLogsQuery, ListLogsResp, ReprocessResp, WebhookLogSummary},
};

// ---------------------------------------------------------------------------
// GET /admin/logs
// ---------------------------------------------------------------------------

/// `GET /admin/logs` — paginated, filterable list of captured webhook
/// deliveries.
///
/// Filters: `projectId`, `status`, `start`/`end` (unix ms on `receivedAt`).
/// Pagination is timestamp-based; pass back the previous response's
/// `nextCursor` to fetch the next (older) page.
pub async fn list_logs(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListLogsQuery>,
) -> Result<Json<ListLogsResp>> {
    auth_check::ensure_admin(&user, q.project_id.as_deref())?;

    // Clamp `limit` defensively. Direct callers (curl, scripts) might try
    // to bypass the TS client cap.
    let limit = q
        .limit
        .map(|l| l.clamp(1, MAX_LIST_LIMIT))
        .unwrap_or(DEFAULT_LIST_LIMIT);

    // Build filter.
    let mut filter = Document::new();

    if let Some(pid) = q.project_id.as_deref() {
        let oid = oid_from_str(pid)?;
        filter.insert("projectId", oid);
    }

    if let Some(status) = q.status.as_deref() {
        filter.insert("status", status);
    }

    let mut received_filter = Document::new();
    if let Some(start_ms) = q.start {
        received_filter.insert("$gte", BsonDateTime::from_millis(start_ms));
    }
    if let Some(end_ms) = q.end {
        received_filter.insert("$lte", BsonDateTime::from_millis(end_ms));
    }
    if let Some(cursor) = q.cursor.as_deref() {
        // Cursor is the ISO-8601 `received_at` of the last item we
        // returned. Fetch strictly older rows. Bad cursors are a 400 so
        // the client knows to drop them rather than silently scrolling
        // from the top again.
        let parsed: DateTime<Utc> = cursor
            .parse()
            .map_err(|e| ApiError::BadRequest(format!("invalid cursor: {e}")))?;
        received_filter.insert("$lt", BsonDateTime::from_millis(parsed.timestamp_millis()));
    }
    if !received_filter.is_empty() {
        filter.insert("receivedAt", received_filter);
    }

    let coll = mongo.collection::<Document>(WEBHOOK_LOGS_COLLECTION);

    // We fetch `limit + 1` so we can tell whether there is another page
    // without a separate `count_documents` round-trip. Sort newest first
    // on `receivedAt`, with `_id` as a tiebreaker for stable ordering.
    let find_opts = FindOptions::builder()
        .sort(doc! { "receivedAt": -1, "_id": -1 })
        .limit(Some(limit + 1))
        .build();

    let mut cursor = coll
        .find(filter)
        .with_options(find_opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;

    let mut logs: Vec<WebhookLogSummary> = Vec::with_capacity(limit as usize);
    // We use a manual loop instead of `.try_collect::<Vec<_>>()` so we can
    // skip rows that fail to deserialise without aborting the whole page.
    use futures::TryStreamExt;
    while let Some(doc) = cursor
        .try_next()
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
    {
        match document_to_summary(&doc) {
            Ok(summary) => logs.push(summary),
            Err(e) => tracing::warn!(error = %e, "skipping malformed webhook_log row"),
        }
    }

    let next_cursor = if logs.len() as i64 > limit {
        // Trim the look-ahead row and use *its* timestamp as the next
        // cursor. Using the trimmed-row's timestamp (rather than the
        // last-kept row's) means the next page begins exactly where this
        // one ended, with no overlap or gap.
        let extra = logs.pop().expect("len > limit guarantees at least one element");
        // The next request asks for rows strictly older than the last
        // *returned* row, so we hand back the last-kept row's timestamp.
        // (We popped only to keep the page size at `limit`.)
        let _ = extra;
        logs.last().map(|s| s.received_at.to_rfc3339())
    } else {
        None
    };

    Ok(Json(ListLogsResp { logs, next_cursor }))
}

// ---------------------------------------------------------------------------
// GET /admin/logs/{id}/payload
// ---------------------------------------------------------------------------

/// `GET /admin/logs/{id}/payload` — fetch the raw webhook payload for one
/// log entry.
///
/// The payload is returned untouched as `serde_json::Value` so the client
/// gets the exact bytes Meta sent (modulo BSON ↔ JSON type coercion in the
/// driver).
pub async fn get_payload(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>> {
    // Read access is guarded by the same admin check as everything else
    // in this surface. We don't have project context here so pass `None`.
    auth_check::ensure_admin(&user, None)?;

    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<Document>(WEBHOOK_LOGS_COLLECTION);

    let opts = FindOneOptions::builder()
        .projection(doc! { "payload": 1 })
        .build();

    let raw = coll
        .find_one(doc! { "_id": oid })
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
        .ok_or_else(|| ApiError::NotFound(format!("webhook_log {id}")))?;

    let payload = raw.get("payload").cloned().unwrap_or(Bson::Null);

    let json: serde_json::Value =
        bson::from_bson(payload).map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;

    Ok(Json(json))
}

// ---------------------------------------------------------------------------
// POST /admin/logs/{id}/reprocess
// ---------------------------------------------------------------------------

/// `POST /admin/logs/{id}/reprocess` — flag a captured webhook for replay
/// through the receiver pipeline.
///
/// In this slice we only **mark** the log: status flips to
/// `"pending_reprocess"` and the worker that drains the reprocess queue
/// will pick it up. Doing the inline replay here would require pulling in
/// the receiver's dispatcher (and every per-field processor crate),
/// which violates the slice's "no cross-crate calls" constraint.
///
/// TODO(phase-2-followup): wire reprocess to dispatcher.
pub async fn reprocess(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<ReprocessResp>> {
    auth_check::ensure_admin(&user, None)?;

    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<Document>(WEBHOOK_LOGS_COLLECTION);

    let now = BsonDateTime::now();
    let update = doc! {
        "$set": {
            "status": "pending_reprocess",
            "reprocessRequestedAt": now,
            "reprocessRequestedBy": &user.user_id,
            // Clear the previous error so the worker doesn't see stale info.
            "error": Bson::Null,
        }
    };

    let result = coll
        .update_one(doc! { "_id": oid }, update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;

    if result.matched_count == 0 {
        return Err(ApiError::NotFound(format!("webhook_log {id}")));
    }

    Ok(Json(ReprocessResp { ok: true, log_id: id }))
}

// ---------------------------------------------------------------------------
// POST /admin/logs/clear
// ---------------------------------------------------------------------------

/// `POST /admin/logs/clear` — bulk-delete every log whose `status` is
/// `"processed"`.
///
/// The TS analogue (`handleClearProcessedLogs`) filters on the legacy
/// `{ processed: true }` flag. The slice contract for this Rust port
/// specifies the new field name (`status: "processed"`) — see the
/// final-report assumptions section for the migration plan.
pub async fn clear_processed(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
) -> Result<Json<ClearResp>> {
    auth_check::ensure_admin(&user, None)?;

    let coll = mongo.collection::<Document>(WEBHOOK_LOGS_COLLECTION);

    let result = coll
        .delete_many(doc! { "status": "processed" })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;

    Ok(Json(ClearResp {
        // `deleted_count` is `u64`; `i64` is what we ship on the wire so
        // the value matches the JSON `number` range every JS client uses.
        deleted: result.deleted_count as i64,
    }))
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/// Convert a raw `webhook_logs` document into the public summary DTO.
///
/// Tolerant of two writers:
/// - Legacy TS writer: `createdAt` + `processed: bool` + no `status`.
/// - New Rust writer: `receivedAt` + `status: "processed" | ...`.
///
/// Unknown fields fall back to safe defaults rather than 500-ing the
/// whole page.
fn document_to_summary(raw: &Document) -> std::result::Result<WebhookLogSummary, anyhow::Error> {
    let id = raw
        .get_object_id("_id")
        .map_err(|e| anyhow::anyhow!("missing _id: {e}"))?
        .to_hex();

    let project_id = raw
        .get_object_id("projectId")
        .map(|oid| oid.to_hex())
        .unwrap_or_default();

    // `field` comes from `payload.entry[0].changes[0].field`.
    let field = raw
        .get_document("payload")
        .ok()
        .and_then(|p| p.get_array("entry").ok())
        .and_then(|entries| entries.first())
        .and_then(|b| b.as_document())
        .and_then(|e| e.get_array("changes").ok())
        .and_then(|changes| changes.first())
        .and_then(|b| b.as_document())
        .and_then(|c| c.get_str("field").ok())
        .unwrap_or("unknown")
        .to_owned();

    // Status: prefer the new `status` string; fall back to the legacy
    // `processed: bool` boolean.
    let status = match raw.get_str("status") {
        Ok(s) => s.to_owned(),
        Err(_) => match raw.get_bool("processed") {
            Ok(true) => "processed".to_owned(),
            Ok(false) => "pending".to_owned(),
            Err(_) => "unknown".to_owned(),
        },
    };

    let received_at = raw
        .get_datetime("receivedAt")
        .or_else(|_| raw.get_datetime("createdAt"))
        .map(|dt| DateTime::<Utc>::from(*dt))
        .unwrap_or_else(|_| Utc.timestamp_opt(0, 0).single().expect("epoch is valid"));

    let error = match raw.get("error") {
        Some(Bson::String(s)) if !s.is_empty() => Some(s.clone()),
        _ => None,
    };

    Ok(WebhookLogSummary {
        id,
        project_id,
        field,
        status,
        received_at,
        error,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use bson::oid::ObjectId;

    #[test]
    fn document_to_summary_extracts_field_from_nested_payload() {
        let raw = doc! {
            "_id": ObjectId::new(),
            "projectId": ObjectId::new(),
            "status": "processed",
            "receivedAt": BsonDateTime::from_millis(1_700_000_000_000),
            "payload": {
                "entry": [{
                    "changes": [{ "field": "messages", "value": {} }]
                }]
            }
        };

        let summary = document_to_summary(&raw).expect("parse ok");
        assert_eq!(summary.field, "messages");
        assert_eq!(summary.status, "processed");
        assert!(summary.error.is_none());
    }

    #[test]
    fn document_to_summary_falls_back_to_legacy_processed_flag() {
        let raw = doc! {
            "_id": ObjectId::new(),
            "processed": true,
            "createdAt": BsonDateTime::from_millis(1_700_000_000_000),
            "payload": {
                "entry": [{
                    "changes": [{ "field": "templates", "value": {} }]
                }]
            }
        };
        let summary = document_to_summary(&raw).expect("parse ok");
        assert_eq!(summary.status, "processed");
        assert_eq!(summary.field, "templates");
    }

    #[test]
    fn document_to_summary_ignores_empty_error_string() {
        let raw = doc! {
            "_id": ObjectId::new(),
            "status": "pending",
            "receivedAt": BsonDateTime::now(),
            "error": "",
            "payload": {}
        };
        let summary = document_to_summary(&raw).expect("parse ok");
        assert!(summary.error.is_none());
    }
}
