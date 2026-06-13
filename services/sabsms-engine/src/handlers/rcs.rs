//! V2.11 — batch RCS capability check (`POST /v1/rcs/capability`).
//!
//! Per phone (batch ≤ 100):
//!   1. read `sabsms_identities.rcsCapable` — fresh within 7 days → cache hit;
//!   2. stale/missing → query the workspace's Gupshup RBM capability
//!      endpoint when a Gupshup account exists (Twilio has NO public
//!      per-number RCS capability lookup — capability there is only
//!      learnable from send-time delivery receipts, so it contributes
//!      nothing here);
//!   3. provider results are written back to the identity graph
//!      (`{ rcsCapable: { capable, checkedAt } }`, upsert by
//!      workspaceId+phoneHash, field names matching
//!      `src/lib/sabsms/identity/graph.ts` EXACTLY);
//!   4. unknown (no Gupshup account / provider error) → heuristic
//!      `capable: false`, NOT written back so a later real check isn't
//!      shadowed for 7 days.

use std::collections::HashMap;
use std::sync::Arc;

use axum::{extract::State, Json};
use chrono::Utc;
use mongodb::bson::doc;
use serde::{Deserialize, Serialize};

use crate::{
    compliance, creds, db,
    errors::{EngineError, EngineResult},
    providers::gupshup::GupshupProvider,
    state::AppState,
    types::ProviderId,
};

/// Max phones per capability batch.
pub const MAX_BATCH: usize = 100;

/// Cached capability entries older than this are re-checked.
pub const FRESHNESS_MS: i64 = 7 * 24 * 60 * 60 * 1000;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CapabilityInput {
    pub workspace_id: String,
    pub phones: Vec<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PhoneCapability {
    pub capable: bool,
    /// "cache" | "provider" | "unknown" | "invalid".
    pub source: &'static str,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CapabilityResult {
    pub capabilities: HashMap<String, PhoneCapability>,
}

/// True when a cached `rcsCapable.checkedAt` (epoch ms) is still fresh.
pub fn cache_fresh(checked_at_ms: i64, now_ms: i64) -> bool {
    now_ms.saturating_sub(checked_at_ms) < FRESHNESS_MS
}

pub async fn capability(
    State(state): State<Arc<AppState>>,
    Json(input): Json<CapabilityInput>,
) -> EngineResult<Json<CapabilityResult>> {
    if input.workspace_id.is_empty() {
        return Err(EngineError::BadRequest("workspaceId required".into()));
    }
    if input.phones.is_empty() || input.phones.len() > MAX_BATCH {
        return Err(EngineError::BadRequest(format!(
            "phones must contain 1..={MAX_BATCH} entries"
        )));
    }

    let now_ms = Utc::now().timestamp_millis();
    let mut out: HashMap<String, PhoneCapability> = HashMap::with_capacity(input.phones.len());

    // Normalise + hash. Invalid phones short-circuit to capable=false.
    let mut hashes: Vec<(String, String, String)> = Vec::new(); // (raw, e164, hash)
    for raw in &input.phones {
        match super::send::normalise_e164(raw) {
            Ok(e164) => {
                let hash = compliance::hash_phone(&e164);
                hashes.push((raw.clone(), e164, hash));
            }
            Err(_) => {
                out.insert(
                    raw.clone(),
                    PhoneCapability {
                        capable: false,
                        source: "invalid",
                    },
                );
            }
        }
    }

    // 1) Cached identity reads (one $in query).
    let identities = state
        .mongo
        .collection::<mongodb::bson::Document>(db::COL_IDENTITIES);
    let hash_list: Vec<&str> = hashes.iter().map(|(_, _, h)| h.as_str()).collect();
    let mut cached: HashMap<String, (bool, i64)> = HashMap::new(); // hash → (capable, checkedAt ms)
    if !hash_list.is_empty() {
        let mut cursor = identities
            .find(doc! {
                "workspaceId": &input.workspace_id,
                "phoneHash": { "$in": &hash_list },
            })
            .await?;
        while cursor.advance().await? {
            let doc: mongodb::bson::Document = cursor.deserialize_current()?;
            let Ok(hash) = doc.get_str("phoneHash") else {
                continue;
            };
            let Ok(rcs) = doc.get_document("rcsCapable") else {
                continue;
            };
            let capable = rcs.get_bool("capable").unwrap_or(false);
            let checked_at = rcs
                .get_datetime("checkedAt")
                .map(|d| d.timestamp_millis())
                .unwrap_or(0);
            cached.insert(hash.to_string(), (capable, checked_at));
        }
    }

    let mut to_query: Vec<(String, String, String)> = Vec::new();
    for (raw, e164, hash) in hashes {
        match cached.get(&hash) {
            Some((capable, checked_at)) if cache_fresh(*checked_at, now_ms) => {
                out.insert(
                    raw,
                    PhoneCapability {
                        capable: *capable,
                        source: "cache",
                    },
                );
            }
            _ => to_query.push((raw, e164, hash)),
        }
    }

    // 2) Provider query — Gupshup RBM only (see module docs re Twilio).
    if !to_query.is_empty() {
        let provider_caps = query_gupshup(&state, &input.workspace_id, &to_query).await;
        let now_bson = mongodb::bson::DateTime::from_millis(now_ms);
        for (raw, e164, hash) in to_query {
            match provider_caps.as_ref().and_then(|m| m.get(&e164)) {
                Some(capable) => {
                    // 3) Write back to the identity graph (TS shape).
                    let res = identities
                        .update_one(
                            doc! { "workspaceId": &input.workspace_id, "phoneHash": &hash },
                            doc! {
                                "$set": {
                                    "rcsCapable": { "capable": *capable, "checkedAt": now_bson },
                                    "updatedAt": now_bson,
                                },
                                "$setOnInsert": {
                                    "workspaceId": &input.workspace_id,
                                    "phoneHash": &hash,
                                    "contactIds": [],
                                    "consent": { "state": "unknown", "at": now_bson },
                                    "engagement": { "inbound30d": 0, "clicks30d": 0, "delivered30d": 0 },
                                    "sendTimeHistogram": vec![0_i32; 24],
                                },
                            },
                        )
                        .upsert(true)
                        .await;
                    if let Err(e) = res {
                        if !db::is_duplicate_key_error(&e) {
                            tracing::warn!(?e, "failed to write rcsCapable back to identity graph");
                        }
                    }
                    out.insert(
                        raw,
                        PhoneCapability {
                            capable: *capable,
                            source: "provider",
                        },
                    );
                }
                None => {
                    // 4) Unknown → heuristic false, no write-back.
                    out.insert(
                        raw,
                        PhoneCapability {
                            capable: false,
                            source: "unknown",
                        },
                    );
                }
            }
        }
    }

    Ok(Json(CapabilityResult { capabilities: out }))
}

/// Resolve the workspace's Gupshup account and run the batch capability
/// call. `None` (no account / call failed) means "unknown" for every
/// queried phone.
async fn query_gupshup(
    state: &Arc<AppState>,
    workspace_id: &str,
    to_query: &[(String, String, String)],
) -> Option<HashMap<String, bool>> {
    let resolved = creds::resolve(state, workspace_id, ProviderId::Gupshup, None)
        .await
        .ok()?;
    let phones: Vec<String> = to_query.iter().map(|(_, e164, _)| e164.clone()).collect();
    let adapter = GupshupProvider::new(state.http.clone());
    match adapter.rcs_capability(&phones, &resolved.creds).await {
        Ok(map) => Some(map),
        Err(e) => {
            tracing::warn!(?e, workspace = %workspace_id, "gupshup rcs capability query failed");
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cache_freshness_boundary_is_seven_days() {
        let now = 10_000_000_000_i64;
        // Fresh: checked just now and just under 7d ago.
        assert!(cache_fresh(now, now));
        assert!(cache_fresh(now - (FRESHNESS_MS - 1), now));
        // Stale: exactly 7d and older.
        assert!(!cache_fresh(now - FRESHNESS_MS, now));
        assert!(!cache_fresh(0, now));
        // Degenerate negative ages (clock skew) count as fresh.
        assert!(cache_fresh(now + 60_000, now));
    }

    #[test]
    fn phone_capability_serializes_camel_case() {
        let r = CapabilityResult {
            capabilities: HashMap::from([(
                "+15551234567".to_string(),
                PhoneCapability {
                    capable: true,
                    source: "cache",
                },
            )]),
        };
        let v = serde_json::to_value(&r).unwrap();
        assert_eq!(v["capabilities"]["+15551234567"]["capable"], true);
        assert_eq!(v["capabilities"]["+15551234567"]["source"], "cache");
    }

    #[test]
    fn capability_input_parses_camel_case() {
        let i: CapabilityInput = serde_json::from_str(
            r#"{"workspaceId":"ws1","phones":["+15551234567","+919876543210"]}"#,
        )
        .unwrap();
        assert_eq!(i.workspace_id, "ws1");
        assert_eq!(i.phones.len(), 2);
    }
}
