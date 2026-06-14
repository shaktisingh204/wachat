//! HTTP handler for listing SabSign audit events.
//!
//! Tenant-scoped (`tenantId == JWT tid`). When the caller passes
//! `?envelopeId=…` the response verifies that single envelope's chain;
//! otherwise events are grouped per-envelope and every chain is verified.

use std::collections::BTreeMap;

use axum::{
    Json,
    extract::{Query, State},
};
use bson::doc;
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use tracing::instrument;

use crate::chain::{COLL, verify_chain};
use crate::dto::{ListQuery, ListResponse};
use crate::types::EsignAuditEvent;

#[instrument(skip_all, fields(tenant = %user.tenant_id))]
pub async fn list_audit(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let mut filter = doc! { "tenantId": &user.tenant_id };
    if let Some(env) = q
        .envelope_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        filter.insert("envelopeId", env);
    }
    if let Some(et) = q
        .event_type
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        filter.insert("eventType", et);
    }
    let limit = q.limit.unwrap_or(1000).min(5000) as i64;
    let opts = FindOptions::builder()
        .sort(doc! { "seq": 1 })
        .limit(limit)
        .build();
    let coll = mongo.collection::<EsignAuditEvent>(COLL);
    let items: Vec<EsignAuditEvent> = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("esign_audit.find")))?
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("esign_audit.collect")))?;

    // Group by envelope (items already sorted by seq asc → groups stay
    // ordered) and verify each chain independently.
    let mut groups: BTreeMap<&str, Vec<EsignAuditEvent>> = BTreeMap::new();
    for ev in &items {
        groups
            .entry(ev.envelope_id.as_str())
            .or_default()
            .push(ev.clone());
    }
    let chain_valid = groups.values().all(|g| verify_chain(g));

    Ok(Json(ListResponse { items, chain_valid }))
}
