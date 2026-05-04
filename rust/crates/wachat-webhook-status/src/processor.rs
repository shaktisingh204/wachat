//! Status update processor — the main entry point of this crate.
//!
//! Mirrors the behavior of `processStatusUpdateBatch` in
//! `src/lib/webhook-processor.ts` (line ~1725), restricted to the
//! `outgoing_messages` collection. Quote from the TS for the field names
//! we preserve here:
//!
//! ```text
//! const updateFields: any = {
//!     status: status.status,
//!     [`statusTimestamps.${status.status}`]: new Date(parseInt(status.timestamp, 10) * 1000),
//! };
//! if (status.status === 'failed' && status.errors?.length > 0) {
//!     const err = status.errors[0];
//!     updateFields.error = err.title || err.message || `Error ${err.code}`;
//!     updateFields.errorCode = err.code;
//!     updateFields.errorDetails = err.error_data?.details || err.message;
//! }
//! return { updateOne: { filter: { wamid: status.id }, update: { $set: updateFields } } };
//! ```
//!
//! The Mongo collection name (`outgoing_messages`), the lookup key
//! (`wamid` matching Meta's `status.id`), and the field names (`status`,
//! `statusTimestamps.<state>`, `error`, `errorCode`, `errorDetails`) are
//! all preserved verbatim.
//!
//! ### Idempotency
//!
//! In addition to TS behavior, we add a `status: { $in: [<allowed-prev>] }`
//! clause on the filter (see [`crate::mapping::VALID_STATUS_TRANSITIONS`]).
//! That way:
//! - A duplicate `read` event whose document is already `read` matches **0**
//!   docs and the update is a no-op (counted as a "no-op", not an error).
//! - A late `delivered` arriving after `read` cannot clobber `read` back.
//!
//! ### Failure modes (none of which propagate)
//!
//! - **Unknown wamid**: `update_one` returns `matched_count: 0`. Logged at
//!   `debug` and counted in `failed_lookups`. Not an error — Meta retries
//!   webhooks and may target messages we never persisted.
//! - **Malformed status string**: logged at `warn`, status skipped, batch
//!   continues. Counted in `failed_lookups`.
//! - **Mongo errors on a single update**: logged at `warn`, status counted
//!   in `failed_lookups`, batch continues. Whole-batch errors (e.g. the
//!   driver is down) bubble out as `ApiError::Internal` so the receiver
//!   crate can decide whether to retry.

use bson::{Bson, doc};
use chrono::{TimeZone, Utc};
use mongodb::Collection;
use sabnode_common::ApiError;
use sabnode_db::mongo::MongoHandle;
use serde::{Deserialize, Serialize};
use tracing::{debug, warn};
use wachat_meta_dto::webhook::{ChangeValue, StatusUpdate};
use wachat_types::project::Project;

use crate::mapping::{allowed_previous_statuses, meta_status_to_domain};

/// Mongo collection that holds outbound message rows. Verified against
/// `webhook-processor.ts` (line 1792 — `db.collection('outgoing_messages').bulkWrite(...)`)
/// and the insert sites at lines 148, 207, 256, 385, 442, 567, 614 (all
/// `db.collection('outgoing_messages').insertOne(...)`).
const OUTGOING_MESSAGES: &str = "outgoing_messages";

/// Aggregated outcome of a `process()` call. The receiver uses these counts
/// to feed metrics (`webhook_status_updates_total`, etc.) and to decide
/// whether to schedule a "missing wamid" backfill.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct StatusOutcome {
    /// Number of statuses that successfully updated at least one document.
    pub updated: usize,
    /// Number of statuses that did not match any document (unknown wamid,
    /// idempotent no-op, malformed status, or per-status Mongo error).
    pub failed_lookups: usize,
}

/// Status update processor. Holds a Mongo handle for the `outgoing_messages`
/// collection. Cheap to clone (the underlying `MongoHandle` is `Clone`).
#[derive(Debug, Clone)]
pub struct StatusProcessor {
    mongo: MongoHandle,
}

impl StatusProcessor {
    /// Construct a new processor. The handle is reused across calls — we
    /// don't create a new Mongo client per webhook.
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }

    /// Iterate `value.statuses` (default to empty if absent — Meta sometimes
    /// sends a `messages`-only `value`) and apply each status as a
    /// conditional `$set` on the matching `outgoing_messages` document.
    ///
    /// The `project` argument is currently used only for tracing context;
    /// the wamid is globally unique across Meta so we do not need to filter
    /// by `projectId` here. We still take it in the signature so the
    /// receiver crate can pass through the resolved project without a
    /// downstream signature change when we add per-project metrics.
    pub async fn process(
        &self,
        project: &Project,
        value: &ChangeValue,
    ) -> Result<StatusOutcome, ApiError> {
        let statuses = value.statuses.as_deref().unwrap_or(&[]);
        if statuses.is_empty() {
            return Ok(StatusOutcome::default());
        }

        let coll: Collection<bson::Document> = self.mongo.collection(OUTGOING_MESSAGES);

        let mut outcome = StatusOutcome::default();

        for status in statuses {
            match self.apply_one(&coll, project, status).await {
                Ok(true) => outcome.updated += 1,
                Ok(false) => outcome.failed_lookups += 1,
                Err(err) => {
                    // Single-status Mongo failure — log + count, do not
                    // propagate. A driver-level outage will surface through
                    // many of these in a row and be visible in metrics; one
                    // bad status mustn't fail the whole batch.
                    warn!(
                        project_id = %project.id,
                        wamid = %status.id,
                        status = %status.status,
                        error = %err,
                        "status update failed; continuing batch",
                    );
                    outcome.failed_lookups += 1;
                }
            }
        }

        Ok(outcome)
    }

    /// Apply a single status. Returns `Ok(true)` on a real update,
    /// `Ok(false)` on no-op (unknown wamid / idempotent / malformed),
    /// and `Err` only on Mongo-driver-level failures (which the caller
    /// in `process()` swallows and counts).
    async fn apply_one(
        &self,
        coll: &Collection<bson::Document>,
        project: &Project,
        status: &StatusUpdate,
    ) -> Result<bool, anyhow::Error> {
        // 1) Map the status string. Unknown values are logged and counted
        // as failed_lookups — never an error. (See module docs.)
        let Some(domain_status) = meta_status_to_domain(&status.status) else {
            warn!(
                project_id = %project.id,
                wamid = %status.id,
                status = %status.status,
                "unknown Meta status string; skipping",
            );
            return Ok(false);
        };

        // 2) Build the per-status timestamp. Meta sends Unix seconds as a
        // string (e.g. `"1717000000"`); the TS parses with `parseInt` and
        // multiplies by 1000 for `new Date()`. We mirror with chrono.
        let ts_secs: i64 = status.timestamp.parse().unwrap_or_else(|_| {
            warn!(
                wamid = %status.id,
                ts = %status.timestamp,
                "non-integer status timestamp; falling back to now()",
            );
            Utc::now().timestamp()
        });
        let ts = Utc
            .timestamp_opt(ts_secs, 0)
            .single()
            .unwrap_or_else(Utc::now);

        // 3) Construct the $set fields with the EXACT TS field names.
        //    See the module-level quote for the source-of-truth in
        //    webhook-processor.ts.
        let wire_status = wire_status_str(domain_status);
        let mut set_doc = doc! {
            // `status: status.status` — the lifecycle string.
            "status": wire_status,
            // `statusTimestamps.<status>` — per-state timestamp map. The TS
            // uses bracket notation; we build the dotted key directly.
            format!("statusTimestamps.{wire_status}"): bson::DateTime::from_chrono(ts),
            // We additionally bump `statusUpdatedAt` to drive the analytics
            // queries that group by transition latency. The TS does not set
            // this field today; adding it is additive and matches the
            // domain `MessageLog::status_updated_at` type alias.
            "statusUpdatedAt": bson::DateTime::from_chrono(Utc::now()),
        };

        // 4) On `failed`, attach error details. TS:
        //    `error = err.title || err.message || \`Error ${err.code}\``
        //    Our DTO `MetaApiError` has no `title` field (Meta inconsistently
        //    populates it), so we fall back to `message` then a synthesized
        //    `Error <code>` string. Field names (`error`, `errorCode`,
        //    `errorDetails`) match TS exactly.
        if matches!(domain_status, wachat_types::message::MessageStatus::Failed) {
            if let Some(errs) = status.errors.as_ref() {
                if let Some(err) = errs.first() {
                    let summary = if !err.message.is_empty() {
                        err.message.clone()
                    } else if let Some(code) = err.code {
                        format!("Error {code}")
                    } else {
                        "Unknown Meta error".to_string()
                    };
                    set_doc.insert("error", summary);
                    if let Some(code) = err.code {
                        set_doc.insert("errorCode", code);
                    }
                    let details = err
                        .error_data
                        .as_ref()
                        .and_then(|v| v.get("details"))
                        .and_then(|d| d.as_str())
                        .map(str::to_owned)
                        .unwrap_or_else(|| err.message.clone());
                    if !details.is_empty() {
                        set_doc.insert("errorDetails", details);
                    }
                }
            }
        }

        // 5) Conditional filter. Idempotency clause: only apply if the
        //    current `status` is in the allowed-previous-state set. This
        //    handles `read → read` (no-op) and out-of-order webhooks.
        //    `$exists: false` is appended so a never-yet-seen wamid (no
        //    `status` field) also matches — defensive for old documents
        //    that pre-date the field.
        let prev_allowed: Vec<Bson> = allowed_previous_statuses(&status.status)
            .iter()
            .map(|s| Bson::String((*s).into()))
            .collect();

        let filter = doc! {
            "wamid": &status.id,
            "$or": [
                doc! { "status": { "$in": prev_allowed } },
                doc! { "status": { "$exists": false } },
            ],
        };

        let update = doc! { "$set": set_doc };

        let res = coll.update_one(filter, update).await?;

        if res.matched_count == 0 {
            // Either: (a) wamid unknown — Meta retried for a message we
            // never persisted, or (b) idempotent no-op — current status
            // is already at-or-past the new one. Both are normal.
            debug!(
                project_id = %project.id,
                wamid = %status.id,
                new_status = %status.status,
                "status update matched 0 documents (unknown wamid or idempotent no-op)",
            );
            return Ok(false);
        }

        Ok(true)
    }
}

/// Wire-format string for a [`MessageStatus`]. We avoid round-tripping
/// through `serde_json::to_string` here — for a 4-variant enum a `match`
/// is cheaper, and we need the *unquoted* string to splice into a BSON key.
fn wire_status_str(s: wachat_types::message::MessageStatus) -> &'static str {
    use wachat_types::message::MessageStatus::*;
    match s {
        Queued => "pending",
        Sent => "sent",
        Delivered => "delivered",
        Read => "read",
        Failed => "failed",
    }
}
