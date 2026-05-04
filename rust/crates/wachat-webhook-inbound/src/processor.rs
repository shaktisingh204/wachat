//! Inbound message processor — the main entry point of this crate.
//!
//! Mirrors `handleSingleMessageEvent` / `processMessageBatch` in
//! `src/lib/webhook-processor.ts`. The minimal canonical write is at line
//! 1502 (also bulk-replicated at line 1893):
//!
//! ```text
//! await db.collection('incoming_messages').updateOne(
//!     { wamid: message.id, projectId: project._id },
//!     { $setOnInsert: {
//!         direction: 'in',
//!         projectId: project._id,
//!         contactId: contact._id,
//!         wamid: message.id,
//!         messageTimestamp: new Date(parseInt(message.timestamp, 10) * 1000),
//!         type: message.type,
//!         content: message,
//!         isRead: false,
//!         createdAt: new Date(),
//!     } },
//!     { upsert: true },
//! );
//! ```
//!
//! Field-name fidelity matters: the existing TS readers (chat UI, analytics
//! pipeline, contact unread-count maintainers) read these exact keys, and
//! the Rust port has to coexist with TS writers in the same collection
//! during the cut-over. So: `direction: "in"`, `projectId`, `wamid`,
//! `messageTimestamp` (BSON `Date`, **not** an ISO string), `type` (the raw
//! Meta wire type — `"text"`, `"image"`, ...), `content` (the original
//! payload, preserved verbatim for forensic debugging and the chat UI's
//! rich rendering), `isRead`, `createdAt`.
//!
//! Notable difference from TS: the TS write also stores `contactId`. The
//! contact-resolution pass lives in a sibling phase-2 crate
//! (`wachat-webhook-contacts`) — this crate persists the message row
//! without the FK and the receiver crate later patches it in.
//!
//! ### Idempotency
//!
//! `update_one` with `$setOnInsert` and `upsert: true` is the natural
//! Mongo primitive for "insert iff not present, otherwise no-op". Whether
//! the row was created is read off `UpdateResult::upserted_id`:
//! - `Some(_)` → new row was inserted, count it as `stored`.
//! - `None`     → the wamid was already present, count it as `duplicates`.
//!
//! That mirrors the TS dedup at line 1830 (`existingDocs` pre-fetch) but
//! avoids the extra round-trip — the upsert race is resolved server-side.

use bson::{Bson, doc};
use chrono::{TimeZone, Utc};
use mongodb::Collection;
use mongodb::options::UpdateOptions;
use sabnode_common::ApiError;
use sabnode_db::mongo::MongoHandle;
use serde::{Deserialize, Serialize};
use tracing::{debug, warn};
use wachat_meta_dto::webhook::{ChangeValue, InboundMessage};
use wachat_types::project::Project;

use crate::error::{bad_timestamp, map_mongo};
use crate::mapping::message_kind;

/// Mongo collection that holds inbound message rows. Verified against
/// `webhook-processor.ts` line 1359 (pre-check `findOne`), line 1502
/// (single-message upsert), line 1830 (batch dedup `find`), line 1914
/// (batch upsert `bulkWrite`). All four sites name the collection
/// `incoming_messages`.
const INCOMING_MESSAGES: &str = "incoming_messages";

/// Aggregated outcome of a [`InboundProcessor::process`] call. Counts are
/// per-message; the receiver crate uses them to feed metrics
/// (`webhook_inbound_messages_total`, etc.) and to decide whether to log a
/// duplicate-burst warning when Meta retries aggressively.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct InboundOutcome {
    /// Number of messages that produced a brand-new `incoming_messages` row.
    pub stored: usize,
    /// Number of messages whose `wamid` was already present (idempotent).
    pub duplicates: usize,
}

/// Inbound message processor. Holds a Mongo handle for the
/// `incoming_messages` collection. Cheap to clone — the underlying
/// `MongoHandle` is `Arc`-backed.
#[derive(Debug, Clone)]
pub struct InboundProcessor {
    mongo: MongoHandle,
}

impl InboundProcessor {
    /// Construct a new processor. The handle is reused across calls — we
    /// never create a new Mongo client per webhook.
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }

    /// Iterate `value.messages` (default to empty if absent — most webhook
    /// events are status-only and won't carry a `messages` array) and
    /// upsert each one into `incoming_messages`.
    ///
    /// The `project` argument:
    /// - Provides `projectId` for the filter and stored row (per-tenant
    ///   isolation; wamid is globally unique on Meta but we still scope by
    ///   project for defence-in-depth against any cross-tenant collision).
    /// - Will gain richer use once contact-resolution lands and we need
    ///   per-project quotas.
    ///
    /// Per-message Mongo failures bubble out as `ApiError::Internal` and
    /// abort the rest of the batch. That's intentional: a write failure
    /// here means the connection is unhealthy, and the receiver crate
    /// should route the entire payload to DLQ rather than half-storing it.
    pub async fn process(
        &self,
        project: &Project,
        value: &ChangeValue,
    ) -> Result<InboundOutcome, ApiError> {
        let messages = value.messages.as_deref().unwrap_or_default();

        if messages.is_empty() {
            return Ok(InboundOutcome::default());
        }

        let coll: Collection<bson::Document> = self.mongo.collection(INCOMING_MESSAGES);
        let mut outcome = InboundOutcome::default();

        for msg in messages {
            match self.upsert_one(&coll, project, msg).await? {
                UpsertKind::Inserted => outcome.stored += 1,
                UpsertKind::Duplicate => outcome.duplicates += 1,
            }
        }

        // TODO(phase-sabflow): trigger flow execution for newly-stored
        // messages here (or, more likely, hand off to a `wachat-flow-runtime`
        // crate the receiver invokes after persistence). The TS equivalent
        // (`handleFlowLogic`, `triggerAutoReply`, `handleOptInOut` —
        // `webhook-processor.ts:1537-1551` and `:1923-1934`) is ~2.3k lines
        // of flow runtime and is intentionally out of scope for this crate.

        debug!(
            project_id = %project.id,
            stored = outcome.stored,
            duplicates = outcome.duplicates,
            "inbound batch processed",
        );

        Ok(outcome)
    }

    /// Persist one inbound message. Returns whether the document was newly
    /// created (`Inserted`) or already existed (`Duplicate`).
    async fn upsert_one(
        &self,
        coll: &Collection<bson::Document>,
        project: &Project,
        msg: &InboundMessage,
    ) -> Result<UpsertKind, ApiError> {
        let (filter, set_on_insert) = build_inbound_doc(project, msg)?;
        let update = doc! { "$setOnInsert": set_on_insert };

        let opts = UpdateOptions::builder().upsert(true).build();
        let result = coll
            .update_one(filter, update)
            .with_options(opts)
            .await
            .map_err(map_mongo)?;

        if result.upserted_id.is_some() {
            debug!(
                project_id = %project.id,
                wamid = %msg.id,
                kind = message_kind(msg),
                "inbound message stored",
            );
            Ok(UpsertKind::Inserted)
        } else {
            warn!(
                project_id = %project.id,
                wamid = %msg.id,
                "duplicate inbound message — already stored",
            );
            Ok(UpsertKind::Duplicate)
        }
    }
}

/// Build the `(filter, $setOnInsert)` document pair for one inbound message.
///
/// Pure — no I/O, no globals beyond `Utc::now()` for `createdAt`. Public so
/// the integration tests can assert the persisted shape without spinning up
/// Mongo. The filter is `{ wamid, projectId }` (the unique-ish key) and the
/// payload mirrors the TS write at `webhook-processor.ts:1505-1515`.
pub fn build_inbound_doc(
    project: &Project,
    msg: &InboundMessage,
) -> Result<(bson::Document, bson::Document), ApiError> {
    // Parse Meta's unix-second string. Non-numeric is malformed → 400.
    let ts_secs: i64 = msg
        .timestamp
        .parse()
        .map_err(|_| bad_timestamp(&msg.timestamp))?;
    let message_ts = Utc.timestamp_opt(ts_secs, 0).single().ok_or_else(|| {
        ApiError::BadRequest(format!("inbound message timestamp out of range: {ts_secs}"))
    })?;
    let message_ts_bson = bson::DateTime::from_chrono(message_ts);
    let now_bson = bson::DateTime::from_chrono(Utc::now());

    // Round-trip the whole inbound payload into BSON so the chat UI can
    // re-render media captions, interactive replies, and location pins
    // without re-parsing the wire format.
    let content_bson = bson::to_bson(msg).map_err(|e| {
        ApiError::Internal(anyhow::anyhow!("failed to serialise inbound message: {e}"))
    })?;

    let filter = doc! {
        "wamid": &msg.id,
        "projectId": project.id,
    };
    let set_on_insert = doc! {
        "direction": "in",
        "projectId": project.id,
        "contactId": Bson::Null,
        "wamid": &msg.id,
        "messageTimestamp": message_ts_bson,
        "type": &msg.r#type,
        "content": content_bson,
        "isRead": false,
        "createdAt": now_bson,
    };
    Ok((filter, set_on_insert))
}

/// Outcome of a single upsert. Internal — surfaced to callers only via the
/// aggregated [`InboundOutcome`] counts.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum UpsertKind {
    Inserted,
    Duplicate,
}
