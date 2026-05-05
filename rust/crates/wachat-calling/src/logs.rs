//! Read-only access to the `crm_call_logs` Mongo collection.
//!
//! Populated by `src/lib/call-webhook-processor.ts` (status webhook handler
//! for inbound calls). The legacy TS `getCallLogs` returned the last 100
//! documents sorted by `createdAt: -1`. We preserve that shape so the call
//! logs page can keep treating the response as `CallLog[]`.

use bson::{Document, doc, oid::ObjectId};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use serde::Serialize;
use serde_json::Value;

const CALL_LOGS_COLL: &str = "crm_call_logs";
const DEFAULT_LIMIT: i64 = 100;

/// Result of `GET /v1/wachat/calling/projects/{id}/logs`.
///
/// The TS server action returned the raw cursor array; we wrap it in an
/// envelope so the rust-client TS can call `.logs` rather than re-parse a
/// bare array.
#[derive(Debug, Clone, Serialize)]
pub struct CallLogsResponse {
    pub logs: Vec<Value>,
}

/// `db.crm_call_logs.find({projectId}).sort({createdAt:-1}).limit(100)`.
pub async fn list(mongo: &MongoHandle, project_id: &ObjectId) -> Result<CallLogsResponse> {
    let coll = mongo.collection::<Document>(CALL_LOGS_COLL);
    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .limit(DEFAULT_LIMIT)
        .build();

    let cursor = coll
        .find(doc! { "projectId": project_id })
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("call_logs.find")))?;

    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("call_logs.collect")))?;

    let logs = docs
        .into_iter()
        .map(|d| {
            // bson::Document -> serde_json::Value preserves ObjectId/DateTime
            // as canonical-extended-JSON objects (`{$oid:...}`, `{$date:...}`).
            // The legacy TS callers already coerce these via `_id.toString()`
            // and `new Date()` on the client, so the wire shape lines up.
            serde_json::to_value(d).map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))
        })
        .collect::<Result<Vec<_>>>()?;

    Ok(CallLogsResponse { logs })
}
