//! Calls-webhook processing.
//!
//! Meta delivers WhatsApp Business Calling events under a `calls` change:
//! `change.value.calls = [{ id, from, to, event, timestamp, direction,
//! status, duration, ... }]` (ring / accept / reject / terminate / permission).
//! The webhook receiver calls [`process`] with the `change.value` object and the
//! resolved project; we append each event to `wa_calls` for the call-log UI.

use bson::{DateTime, doc, oid::ObjectId};
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use serde_json::Value;

const CALLS_COLL: &str = "wa_calls";

/// Parse `value.calls[]` and append each event to `wa_calls`. Returns the
/// number of events stored. No-op (Ok(0)) if there are no calls in the change.
pub async fn process(mongo: &MongoHandle, project_id: &ObjectId, value: &Value) -> Result<usize> {
    let calls = match value.get("calls").and_then(|c| c.as_array()) {
        Some(c) if !c.is_empty() => c,
        _ => return Ok(0),
    };

    let coll = mongo.collection::<bson::Document>(CALLS_COLL);
    let mut stored = 0usize;

    for call in calls {
        let raw = bson::to_bson(call).map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
        let str_field = |k: &str| call.get(k).and_then(|v| v.as_str()).map(str::to_owned);

        let row = doc! {
            "_id": ObjectId::new(),
            "projectId": project_id,
            "wacid": str_field("id"),
            "event": str_field("event"),
            "direction": str_field("direction"),
            "status": str_field("status"),
            "from": str_field("from"),
            "to": str_field("to"),
            "duration": call.get("duration").and_then(|v| v.as_i64()),
            "raw": raw,
            "createdAt": DateTime::now(),
        };

        coll.insert_one(row)
            .await
            .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("wa_calls.insert")))?;
        stored += 1;
    }

    Ok(stored)
}
