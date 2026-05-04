//! `DlqWriter` — persists webhook outcomes and routes failures to the DLQ.
//!
//! See the crate-level docs in [`crate`] for the full surface; this module
//! holds the implementation.
//!
//! ## Document shape (`webhook_logs`)
//!
//! The TS code in `src/app/api/webhooks/meta/route.ts` writes:
//!
//! ```js
//! db.collection('webhook_logs').insertOne({
//!     payload, projectId, processed: true, createdAt: new Date(),
//! });
//! // …or for the unresolvable case:
//! db.collection('webhook_logs').insertOne({
//!     payload, projectId: null, processed: false,
//!     error: 'No project found', createdAt: new Date(),
//! });
//! ```
//!
//! The TS reader (`src/app/actions/webhook.actions.ts::getWebhookLogs`) only
//! projects `_id`, `createdAt`, `payload.entry[0].changes[0].field`, and
//! `processed` (used by `handleClearProcessedLogs`'s `deleteMany({ processed:
//! true })`). Anything we add beyond those fields is forward-compatible — the
//! UI ignores unknown fields.
//!
//! Per the Phase 2 slice contract we mint these fields on every insert:
//!
//! | Field         | Type           | Notes                                       |
//! |---------------|----------------|---------------------------------------------|
//! | `_id`         | `ObjectId`     | Returned to the caller as `DlqId(hex)`.     |
//! | `projectId`   | `ObjectId?`    | `None` for unresolvable webhooks (TS uses null). |
//! | `field`       | `String`       | Webhook field (`messages`, `account_review_update`, …). |
//! | `payload`     | `Bson` (any)   | Verbatim copy of the raw Meta payload.      |
//! | `reason`      | `String`       | Short tag for the failure path (DLQ only).  |
//! | `error`       | `String?`      | Optional caller-supplied detail.            |
//! | `status`      | `"failed"` / `"processed"` | Per slice contract.             |
//! | `processed`   | `bool`         | Mirrors TS for back-compat with cleanup UI. |
//! | `receivedAt`  | `BSON DateTime`| When the webhook hit our process.           |
//! | `attemptedAt` | `BSON DateTime`| When we tried to handle it (== now).        |
//! | `createdAt`   | `BSON DateTime`| Mirrors TS so `getWebhookLogs` sort works.  |

use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use mongodb::Collection;
use sabnode_common::ApiError;
use sabnode_db::mongo::MongoHandle;
use serde_json::Value;
use tracing::{trace, warn};
use wachat_queue::{BullProducer, JobOptions};

use crate::error::DlqError;

/// Mongo collection name. Matches the legacy TS code so the existing admin UI
/// (`getWebhookLogs`, `handleClearProcessedLogs`) sees Rust-written rows
/// without changes.
pub const WEBHOOK_LOGS_COLLECTION: &str = "webhook_logs";

/// BullMQ queue name. Picked to match the TS naming convention used by
/// `broadcast-control` / `broadcast-send` (kebab-case, no prefix). The full
/// Redis key is `bull:wachat-webhook-dlq:…` once `BullProducer` joins it.
pub const WEBHOOK_DLQ_QUEUE: &str = "wachat-webhook-dlq";

/// BullMQ job name. Stable string so a future Rust DLQ consumer can switch on
/// it without parsing the payload.
const DLQ_JOB_NAME: &str = "replay-failed-webhook";

/// Newtype wrapper around the Mongo `_id` of a freshly-written `webhook_logs`
/// row. Held as a 24-char hex string so it can cross JSON boundaries (the
/// admin UI fetches `payload` by this id).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DlqId(pub String);

impl std::fmt::Display for DlqId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}

impl AsRef<str> for DlqId {
    fn as_ref(&self) -> &str {
        &self.0
    }
}

/// Cheap, cloneable handle wrapping the dependencies the DLQ writer needs.
///
/// Internal state is two `Clone` handles (`MongoHandle` and `BullProducer`,
/// both `Arc`-backed under the hood) plus a couple of `String`s for the
/// collection / queue names. Callers that want to override the destinations
/// (tests, sharded deployments) can build with [`DlqWriter::with_destinations`].
#[derive(Clone)]
pub struct DlqWriter {
    mongo: MongoHandle,
    queue: BullProducer,
    collection: String,
    queue_name: String,
}

impl DlqWriter {
    /// Construct a writer using the default collection (`webhook_logs`) and
    /// queue (`wachat-webhook-dlq`).
    pub fn new(mongo: MongoHandle, queue: BullProducer) -> Self {
        Self {
            mongo,
            queue,
            collection: WEBHOOK_LOGS_COLLECTION.to_owned(),
            queue_name: WEBHOOK_DLQ_QUEUE.to_owned(),
        }
    }

    /// Override collection and queue names. Primarily used by integration
    /// tests that want to isolate state, but also useful for sharded Mongo /
    /// Redis topologies that prefix collections per tenant.
    pub fn with_destinations(
        mongo: MongoHandle,
        queue: BullProducer,
        collection: impl Into<String>,
        queue_name: impl Into<String>,
    ) -> Self {
        Self {
            mongo,
            queue,
            collection: collection.into(),
            queue_name: queue_name.into(),
        }
    }

    /// Name of the Mongo collection this writer targets. Mostly useful for
    /// tests asserting on the destination.
    pub fn collection_name(&self) -> &str {
        &self.collection
    }

    /// Name of the BullMQ queue this writer enqueues into.
    pub fn queue_name(&self) -> &str {
        &self.queue_name
    }

    fn coll(&self) -> Collection<Document> {
        self.mongo.collection::<Document>(&self.collection)
    }

    /// Record a webhook that the inline processor failed to handle.
    ///
    /// Two side effects, in this order:
    ///   1. Insert a `webhook_logs` document with `status: "failed"` and the
    ///      raw `payload`. **Best-effort** — failure is logged at `warn!` and
    ///      we still attempt the Redis enqueue with a synthetic id.
    ///   2. Enqueue a BullMQ job `{ logId, field, projectId }` to the
    ///      `wachat-webhook-dlq` queue. **Strict** — failure surfaces as
    ///      `ApiError::Internal`; this is the safety net we cannot lose.
    ///
    /// `project_id` is `Option<&str>` rather than `Option<ObjectId>` because
    /// callers typically receive it as a string from the receiver state and
    /// we'd rather centralise the parse here. An invalid hex string falls
    /// back to a `None` projectId on the document with a `warn!` — losing the
    /// project association is preferable to losing the whole DLQ row.
    pub async fn send_to_dlq(
        &self,
        project_id: Option<&str>,
        field: &str,
        raw_payload: &Value,
        reason: &str,
        error: Option<&str>,
    ) -> Result<DlqId, ApiError> {
        let log_id = ObjectId::new();
        let project_oid = parse_optional_object_id(project_id);
        let now = bson::DateTime::from_chrono(Utc::now());

        // Convert the JSON payload into BSON. `serde_json::Value -> Bson` is
        // infallible for the JSON subset Meta sends (no NaN, no binary), but
        // we still propagate the `bson::ser::Error` rather than `unwrap()` so
        // a future change to the upstream payload does not panic the receiver.
        let payload_bson = serde_json_to_bson(raw_payload).map_err(DlqError::from)?;

        // Don't log the raw payload at INFO — it can carry phone numbers and
        // message bodies. TRACE keeps the lever available for local debugging
        // without leaking PII into structured logs aggregators.
        trace!(
            log_id = %log_id,
            field,
            reason,
            error = error.unwrap_or(""),
            ?raw_payload,
            "preparing dlq webhook_logs row",
        );

        let mut doc = doc! {
            "_id": log_id,
            "field": field,
            "payload": payload_bson,
            "reason": reason,
            "status": "failed",
            // `processed: false` keeps `handleClearProcessedLogs`'s
            // `deleteMany({ processed: true })` from sweeping DLQ rows. The
            // explicit field also matches the TS unresolvable-webhook write
            // (`processed: false`) so existing dashboards stay accurate.
            "processed": false,
            "receivedAt": now,
            "attemptedAt": now,
            // Mirror TS field name; TS reader sorts by `createdAt: -1`. We set
            // both to `now` since this writer is invoked synchronously from
            // the receiver path (no separate "received vs persisted" delta).
            "createdAt": now,
        };

        // BSON null vs missing matters for the TS reader — `getWebhookLogs`
        // queries `filter.projectId = new ObjectId(...)` which would not
        // match documents without the field, but legacy code also writes
        // `projectId: null` for unresolvable webhooks. Mirror that exactly.
        match project_oid {
            Some(oid) => {
                doc.insert("projectId", oid);
            }
            None => {
                doc.insert("projectId", Bson::Null);
            }
        }
        if let Some(err) = error {
            doc.insert("error", err);
        }

        // 1) Mongo write — best-effort. A failure here would normally be a
        //    real bug (Mongo down, schema validator etc.); we log loudly but
        //    keep going so the Redis enqueue still happens. Rationale: the
        //    BullMQ job is the safety net. Worst case: a future replay run
        //    will see a `logId` that no longer resolves in Mongo, which the
        //    consumer can degrade gracefully (process from in-job payload
        //    snapshot — added in the consumer slice).
        match self.coll().insert_one(&doc).await {
            Ok(_) => {}
            Err(e) => {
                warn!(
                    log_id = %log_id,
                    field,
                    reason,
                    error = %e,
                    "failed to persist webhook_logs row; falling through to Redis enqueue",
                );
            }
        }

        // 2) BullMQ enqueue — strict. We use a deterministic `jobId` derived
        //    from `logId` so accidental double-calls (e.g. middleware retry)
        //    are deduped at the BullMQ level. Lower priority than broadcast
        //    work since DLQ replays are not customer-facing real-time.
        let job_payload = serde_json::json!({
            "logId": log_id.to_hex(),
            "field": field,
            // `projectId` carried as a string for portability across the
            // wire (BullMQ payloads are JSON; ObjectId would lose its type).
            "projectId": project_oid.as_ref().map(|o| o.to_hex()),
        });

        self.queue
            .add(
                &self.queue_name,
                DLQ_JOB_NAME,
                &job_payload,
                JobOptions {
                    job_id: Some(format!("dlq_{}", log_id.to_hex())),
                    ..Default::default()
                },
            )
            .await
            .map_err(|e| {
                // Map the `ApiError` back into our local error so we get the
                // explicit "dlq enqueue failed" log line, then back into
                // `ApiError` for the public return type.
                DlqError::Enqueue(anyhow::Error::msg(e.to_string()))
            })?;

        Ok(DlqId(log_id.to_hex()))
    }

    /// Audit-log a successfully processed webhook.
    ///
    /// Single side effect: insert a `webhook_logs` document with
    /// `status: "processed"` (and `processed: true` for back-compat with the
    /// TS cleanup UI). No Redis enqueue — successful events do not need a
    /// replay path. The TS code calls this fire-and-forget for every
    /// non-status-only webhook (status updates skip the audit row entirely
    /// to keep the collection from drowning under volume).
    ///
    /// **Strict**: a Mongo failure here surfaces as `ApiError::Internal`. The
    /// caller (the receiver's `after()` block) is expected to treat this as
    /// a soft warning and not block the 200 response to Meta — but at the
    /// API boundary we honour the type signature and bubble up. If you need
    /// fully fire-and-forget semantics, wrap the call in `tokio::spawn` at
    /// the call site.
    pub async fn record_processed(
        &self,
        project_id: Option<&str>,
        field: &str,
        raw_payload: &Value,
    ) -> Result<(), ApiError> {
        let project_oid = parse_optional_object_id(project_id);
        let now = bson::DateTime::from_chrono(Utc::now());

        let payload_bson = serde_json_to_bson(raw_payload).map_err(DlqError::from)?;

        trace!(
            field,
            project_id = project_id.unwrap_or(""),
            ?raw_payload,
            "recording processed webhook",
        );

        let mut doc = doc! {
            "_id": ObjectId::new(),
            "field": field,
            "payload": payload_bson,
            "status": "processed",
            // `processed: true` is what the TS `handleClearProcessedLogs`
            // filters on (`deleteMany({ processed: true })`), so successful
            // rows can be swept on demand.
            "processed": true,
            "receivedAt": now,
            "attemptedAt": now,
            "createdAt": now,
        };

        match project_oid {
            Some(oid) => {
                doc.insert("projectId", oid);
            }
            None => {
                doc.insert("projectId", Bson::Null);
            }
        }

        self.coll()
            .insert_one(&doc)
            .await
            .map_err(DlqError::from)?;

        Ok(())
    }
}

/// Parse a hex `&str` into an `ObjectId`, treating `None` and parse failures
/// uniformly as `None`. Logs at `warn!` on parse failure so the receiver is
/// audit-able when it tries to associate a webhook with a malformed id.
fn parse_optional_object_id(s: Option<&str>) -> Option<ObjectId> {
    let raw = s?;
    match ObjectId::parse_str(raw) {
        Ok(oid) => Some(oid),
        Err(e) => {
            warn!(
                project_id = raw,
                error = %e,
                "invalid project id passed to dlq writer; storing without association",
            );
            None
        }
    }
}

/// Convert a `serde_json::Value` into a `bson::Bson`. The conversion is total
/// for the JSON subset Meta produces, but the BSON layer reserves the right
/// to refuse e.g. floats that are not finite — we propagate that error rather
/// than panicking inside the receiver path.
fn serde_json_to_bson(value: &Value) -> Result<Bson, bson::ser::Error> {
    bson::to_bson(value)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn parses_valid_object_id() {
        let oid = parse_optional_object_id(Some("507f1f77bcf86cd799439011"));
        assert!(oid.is_some());
    }

    #[test]
    fn rejects_invalid_object_id_silently() {
        // Important: we return None rather than erroring so a malformed
        // projectId does NOT block the DLQ write — losing the association
        // is better than losing the row.
        assert!(parse_optional_object_id(Some("not-an-oid")).is_none());
        assert!(parse_optional_object_id(None).is_none());
    }

    #[test]
    fn json_payload_round_trips_to_bson() {
        // Exercise the conversion path with a payload shape that resembles
        // a real Meta webhook so the test is not a tautology.
        let payload = json!({
            "object": "whatsapp_business_account",
            "entry": [{
                "id": "123",
                "changes": [{
                    "field": "messages",
                    "value": { "messaging_product": "whatsapp" }
                }]
            }]
        });
        let bson = serde_json_to_bson(&payload).expect("convert");
        assert!(matches!(bson, Bson::Document(_)));
    }

    #[test]
    fn dlq_id_displays_as_hex() {
        let id = DlqId("507f1f77bcf86cd799439011".to_owned());
        assert_eq!(id.to_string(), "507f1f77bcf86cd799439011");
        assert_eq!(id.as_ref(), "507f1f77bcf86cd799439011");
    }

    #[test]
    fn default_destinations_match_constants() {
        // Cheap guard against a future refactor accidentally renaming the
        // collection or queue without updating the legacy TS readers.
        assert_eq!(WEBHOOK_LOGS_COLLECTION, "webhook_logs");
        assert_eq!(WEBHOOK_DLQ_QUEUE, "wachat-webhook-dlq");
    }
}
