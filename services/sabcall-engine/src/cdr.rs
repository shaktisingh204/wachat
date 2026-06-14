//! Call Detail Record write-back into `sabcall_calls` (the same collection the
//! `sabcall-calls` crate + the Next.js call log read).

use mongodb::bson::{doc, oid::ObjectId, DateTime as BsonDateTime};
use mongodb::Database;

/// A finished (or in-progress) call to persist.
pub struct CdrInput {
    /// Project id string (the workspace tenant), matching the `userId` field
    /// the Next.js side scopes every SabCall collection by.
    pub tenant: String,
    pub from_number: String,
    pub to_number: String,
    pub direction: &'static str, // "inbound" | "outbound"
    pub status: String,          // "completed" | "missed" | "failed" | ...
    pub duration_secs: i64,
    pub did_id: Option<ObjectId>,
    pub provider_call_sid: Option<String>,
}

/// Insert a CDR. Failures are logged but never bubble up — losing a CDR must
/// not break call teardown.
pub async fn write(db: &Database, cdr: CdrInput) {
    let now = BsonDateTime::now();
    let mut d = doc! {
        // The tenant scope field is `userId` (= the SabCall project id), matching
        // the sabcall-calls crate + sabcall.actions.ts.
        "userId": cdr.tenant,
        "fromNumber": cdr.from_number,
        "toNumber": cdr.to_number,
        "direction": cdr.direction,
        "status": cdr.status,
        "durationSecs": cdr.duration_secs,
        "provider": "asterisk",
        "startedAt": now,
        "endedAt": now,
        "createdAt": now,
        "updatedAt": now,
    };
    if let Some(did) = cdr.did_id {
        d.insert("didId", did);
    }
    if let Some(sid) = cdr.provider_call_sid {
        d.insert("providerCallSid", sid);
    }
    if let Err(e) = db.collection("sabcall_calls").insert_one(d).await {
        tracing::warn!(error = %e, "failed to write CDR");
    }
}
