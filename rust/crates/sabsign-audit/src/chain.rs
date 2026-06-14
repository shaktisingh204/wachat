//! Tamper-evident hash chain over `esign_audit_events`.
//!
//! Each event's `hash = SHA-256(prevHash \n envelopeId \n signerId \n
//! eventType \n ts \n data)`. The first event for an envelope chains off the
//! empty string (genesis). `verify_chain` recomputes the chain and reports
//! whether every link matches.

use bson::doc;
use chrono::Utc;
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use serde_json::Value;
use sha2::{Digest, Sha256};

use crate::types::EsignAuditEvent;

pub const COLL: &str = "esign_audit_events";

/// Deterministic SHA-256 hex digest of one event, chained off `prev_hash`.
pub fn hash_event(
    prev_hash: &str,
    envelope_id: &str,
    signer_id: Option<&str>,
    event_type: &str,
    ts: &str,
    data: Option<&Value>,
) -> String {
    let data_json = data.map(|d| d.to_string()).unwrap_or_default();
    let mut hasher = Sha256::new();
    for part in [
        prev_hash,
        envelope_id,
        signer_id.unwrap_or(""),
        event_type,
        ts,
        &data_json,
    ] {
        hasher.update(part.as_bytes());
        hasher.update(b"\n");
    }
    hex::encode(hasher.finalize())
}

/// Append a new audit event for `envelope_id`, chaining off the latest event.
///
/// Best-effort from the caller's perspective: callers that must not fail the
/// surrounding request (e.g. envelope `submit`) should `let _ = ...` the
/// result and log, rather than propagate.
#[allow(clippy::too_many_arguments)]
pub async fn append_event(
    mongo: &MongoHandle,
    tenant_id: &str,
    envelope_id: &str,
    user_id: &str,
    signer_id: Option<&str>,
    event_type: &str,
    ip: Option<&str>,
    data: Option<Value>,
) -> Result<EsignAuditEvent> {
    let coll = mongo.collection::<EsignAuditEvent>(COLL);
    let opts = FindOptions::builder()
        .sort(doc! { "seq": -1 })
        .limit(1)
        .build();
    let prev: Vec<EsignAuditEvent> = coll
        .find(doc! { "envelopeId": envelope_id })
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("esign_audit.find_prev")))?
        .try_collect()
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("esign_audit.collect_prev"))
        })?;
    let (prev_hash, next_seq) = prev
        .first()
        .map(|p| (p.hash.clone(), p.seq + 1))
        .unwrap_or_else(|| (String::new(), 0));

    let ts = Utc::now().to_rfc3339();
    let hash = hash_event(
        &prev_hash,
        envelope_id,
        signer_id,
        event_type,
        &ts,
        data.as_ref(),
    );
    let event = EsignAuditEvent {
        id: Some(bson::oid::ObjectId::new().to_hex()),
        tenant_id: Some(tenant_id.to_owned()),
        envelope_id: envelope_id.to_owned(),
        user_id: user_id.to_owned(),
        signer_id: signer_id.map(str::to_owned),
        event_type: event_type.to_owned(),
        ts,
        ip: ip.map(str::to_owned),
        data,
        seq: next_seq,
        hash,
    };
    coll.insert_one(&event)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("esign_audit.insert")))?;
    Ok(event)
}

/// Recompute the chain over `events` (must be ascending `seq` for ONE
/// envelope) and report whether every link is intact.
pub fn verify_chain(events: &[EsignAuditEvent]) -> bool {
    let mut prev = String::new();
    for ev in events {
        let expected = hash_event(
            &prev,
            &ev.envelope_id,
            ev.signer_id.as_deref(),
            &ev.event_type,
            &ev.ts,
            ev.data.as_ref(),
        );
        if expected != ev.hash {
            return false;
        }
        prev.clone_from(&ev.hash);
    }
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ev(seq: u64, prev: &str, et: &str) -> EsignAuditEvent {
        let ts = format!("2026-06-14T00:00:{:02}Z", seq);
        let hash = hash_event(prev, "env1", None, et, &ts, None);
        EsignAuditEvent {
            id: None,
            tenant_id: None,
            envelope_id: "env1".into(),
            user_id: "u1".into(),
            signer_id: None,
            event_type: et.into(),
            ts,
            ip: None,
            data: None,
            seq,
            hash,
        }
    }

    #[test]
    fn chain_verifies_and_detects_tampering() {
        let e0 = ev(0, "", "submission.created");
        let e1 = ev(1, &e0.hash, "submission.sent");
        let e2 = ev(2, &e1.hash, "submission.completed");
        let chain = vec![e0, e1, e2];
        assert!(verify_chain(&chain));

        let mut tampered = chain.clone();
        tampered[1].event_type = "submission.voided".into();
        assert!(!verify_chain(&tampered));
    }
}
