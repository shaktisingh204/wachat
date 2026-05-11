//! Admin-gated audit-log dashboard.
//!
//! Ports `auditSummaryFor` from `src/lib/compliance/dashboards.ts`.
//!
//! Reads the `audit_events` collection (matches the TS const `COLLECTION` in
//! `src/lib/compliance/audit-log.ts`), filters by tenantId + half-open ISO
//! date range, paginates the cursor up to a hard ceiling (default 10k events
//! to keep latency predictable), then aggregates in-memory into three
//! histograms keyed by `actor`, `resource`, `action`. A `recent` array of the
//! N most recent events (default 50) is also returned for the table preview.

use std::{collections::HashMap, sync::Arc};

use axum::{
    Json, Router,
    extract::{FromRef, Query, State},
    routing::get,
};
use bson::{Document, doc};
use futures::TryStreamExt;
use sabnode_auth::{AuthConfig, AuthUser};
use sabnode_common::{ApiError, Result};
use sabnode_db::{document_to_clean_json, mongo::MongoHandle};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

use crate::guard::require_admin;

const AUDIT_COLL: &str = "audit_events";

/// Query string for `GET /audit/summary`.
#[derive(Debug, Deserialize)]
pub struct AuditSummaryQuery {
    /// Tenant scope — required, matches the `tenantId` arg in the TS helper.
    #[serde(rename = "tenantId")]
    pub tenant_id: String,
    /// Lower bound, ISO-8601, inclusive.
    pub from: String,
    /// Upper bound, ISO-8601, inclusive.
    pub to: String,
    /// Hard ceiling for the event walk. Defaults to 10_000.
    #[serde(default)]
    pub max_events: Option<usize>,
    /// Limit for the `recent` preview array. Defaults to 50.
    #[serde(default)]
    pub recent_limit: Option<usize>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct DateRange {
    pub from: String,
    pub to: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct AuditBucket {
    pub key: String,
    pub count: u64,
    pub failures: u64,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct AuditSummaryResponse {
    #[serde(rename = "tenantId")]
    pub tenant_id: String,
    pub range: DateRange,
    pub total: u64,
    pub failures: u64,
    #[serde(rename = "actionsByActor")]
    pub actions_by_actor: Vec<AuditBucket>,
    #[serde(rename = "actionsByResource")]
    pub actions_by_resource: Vec<AuditBucket>,
    #[serde(rename = "actionsByAction")]
    pub actions_by_action: Vec<AuditBucket>,
    /// Most recent events for the table preview. Opaque JSON because the
    /// underlying `AuditEvent` shape carries free-form `before`/`after`/`metadata`.
    pub recent: Vec<Value>,
}

/// `GET /v1/admin/audit/summary` — paged + bucketed audit-log summary.
///
/// Filters `audit_events` by `tenantId` and the half-open ISO range
/// `[from, to]` (matching the TS helper, which uses `$gte` / `$lte`),
/// sorts by `ts` desc, and walks the cursor in batches of up to 1000 until
/// the ceiling is hit. Failure attribution: an event counts as a failure
/// when `metadata.outcome == "error"`.
pub async fn audit_summary(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<AuditSummaryQuery>,
) -> Result<Json<AuditSummaryResponse>> {
    require_admin(&user)?;

    let ceiling = q.max_events.unwrap_or(10_000).max(100);
    let recent_limit = q.recent_limit.unwrap_or(50).max(1);

    let mut ts_filter = Document::new();
    ts_filter.insert("$gte", &q.from);
    ts_filter.insert("$lte", &q.to);

    let filter = doc! {
        "tenantId": &q.tenant_id,
        "ts": ts_filter,
    };

    let coll = mongo.collection::<Document>(AUDIT_COLL);
    let cursor = coll
        .find(filter)
        .sort(doc! { "ts": -1 })
        .limit(ceiling as i64)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("audit_events.find")))?;

    let events: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("audit_events.collect")))?;

    let total = events.len() as u64;
    let mut failures: u64 = 0;
    let mut by_actor: HashMap<String, (u64, u64)> = HashMap::new();
    let mut by_resource: HashMap<String, (u64, u64)> = HashMap::new();
    let mut by_action: HashMap<String, (u64, u64)> = HashMap::new();

    for evt in &events {
        let is_failure = evt
            .get_document("metadata")
            .ok()
            .and_then(|m| m.get_str("outcome").ok())
            .map(|s| s == "error")
            .unwrap_or(false);
        if is_failure {
            failures += 1;
        }
        bucket_add(&mut by_actor, evt, "actor", is_failure);
        bucket_add(&mut by_resource, evt, "resource", is_failure);
        bucket_add(&mut by_action, evt, "action", is_failure);
    }

    let recent: Vec<Value> = events
        .iter()
        .take(recent_limit)
        .cloned()
        .map(document_to_clean_json)
        .collect();

    Ok(Json(AuditSummaryResponse {
        tenant_id: q.tenant_id.clone(),
        range: DateRange {
            from: q.from,
            to: q.to,
        },
        total,
        failures,
        actions_by_actor: into_sorted_buckets(by_actor),
        actions_by_resource: into_sorted_buckets(by_resource),
        actions_by_action: into_sorted_buckets(by_action),
        recent,
    }))
}

fn bucket_add(
    map: &mut HashMap<String, (u64, u64)>,
    evt: &Document,
    field: &str,
    is_failure: bool,
) {
    let key = evt
        .get_str(field)
        .map(|s| s.to_owned())
        .unwrap_or_else(|_| "unknown".to_owned());
    let entry = map.entry(key).or_insert((0, 0));
    entry.0 += 1;
    if is_failure {
        entry.1 += 1;
    }
}

fn into_sorted_buckets(map: HashMap<String, (u64, u64)>) -> Vec<AuditBucket> {
    let mut out: Vec<AuditBucket> = map
        .into_iter()
        .map(|(key, (count, failures))| AuditBucket {
            key,
            count,
            failures,
        })
        .collect();
    out.sort_by(|a, b| b.count.cmp(&a.count));
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn evt(actor: &str, resource: &str, action: &str, outcome: Option<&str>) -> Document {
        let mut d = doc! {
            "actor": actor,
            "resource": resource,
            "action": action,
            "ts": "2026-01-01T00:00:00Z",
        };
        if let Some(o) = outcome {
            d.insert("metadata", doc! { "outcome": o });
        }
        d
    }

    #[test]
    fn buckets_count_events_and_failures() {
        let events = vec![
            evt("alice", "users/1", "login", Some("ok")),
            evt("alice", "users/1", "login", Some("error")),
            evt("bob", "users/2", "delete", Some("error")),
            evt("alice", "users/2", "delete", None),
        ];

        let mut by_actor: HashMap<String, (u64, u64)> = HashMap::new();
        let mut by_action: HashMap<String, (u64, u64)> = HashMap::new();
        for evt in &events {
            let fail = evt
                .get_document("metadata")
                .ok()
                .and_then(|m| m.get_str("outcome").ok())
                .map(|s| s == "error")
                .unwrap_or(false);
            bucket_add(&mut by_actor, evt, "actor", fail);
            bucket_add(&mut by_action, evt, "action", fail);
        }

        let actor_buckets = into_sorted_buckets(by_actor);
        // Sorted desc by count: alice=3 then bob=1.
        assert_eq!(actor_buckets[0].key, "alice");
        assert_eq!(actor_buckets[0].count, 3);
        assert_eq!(actor_buckets[0].failures, 1);
        assert_eq!(actor_buckets[1].key, "bob");
        assert_eq!(actor_buckets[1].count, 1);
        assert_eq!(actor_buckets[1].failures, 1);

        let action_buckets = into_sorted_buckets(by_action);
        let login = action_buckets.iter().find(|b| b.key == "login").unwrap();
        let delete = action_buckets.iter().find(|b| b.key == "delete").unwrap();
        assert_eq!((login.count, login.failures), (2, 1));
        assert_eq!((delete.count, delete.failures), (2, 1));
    }

    #[test]
    fn bucket_add_handles_missing_field() {
        let mut map: HashMap<String, (u64, u64)> = HashMap::new();
        let evt = doc! { "ts": "2026-01-01T00:00:00Z" };
        bucket_add(&mut map, &evt, "actor", false);
        assert_eq!(map.get("unknown"), Some(&(1, 0)));
    }
}

pub fn routes<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new().route("/audit/summary", get(audit_summary))
}
