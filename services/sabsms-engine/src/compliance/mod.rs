//! Pre-send compliance checks.
//!
//! Both the HTTP enqueue handler and the worker call
//! [`pre_send_checks`] — campaigns will eventually enqueue straight to
//! the Redis queue, so the worker must re-check even though the API
//! already did.

use std::sync::Arc;

use mongodb::bson::doc;
use sha2::{Digest, Sha256};

use crate::{db, errors::EngineResult, state::AppState};

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Verdict {
    Allow,
    Block { code: String, reason: String },
}

/// Hash a phone for the suppression list. SHA-256 lowercase hex.
pub fn hash_phone(e164: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(e164.as_bytes());
    hex::encode(hasher.finalize())
}

/// Run all pre-send checks for an outbound message. Currently:
/// suppression-list lookup. Quiet hours / rate policies land later
/// (they will add a `Reschedule` verdict).
pub async fn pre_send_checks(
    state: &Arc<AppState>,
    workspace_id: &str,
    to_e164: &str,
) -> EngineResult<Verdict> {
    let phone_hash = hash_phone(to_e164);
    let suppressions = state
        .mongo
        .collection::<mongodb::bson::Document>(db::COL_SUPPRESSIONS);
    if suppressions
        .find_one(doc! { "workspaceId": workspace_id, "phoneHash": &phone_hash })
        .await?
        .is_some()
    {
        return Ok(Verdict::Block {
            code: "suppressed".into(),
            reason: "recipient is on the suppression list".into(),
        });
    }
    Ok(Verdict::Allow)
}
