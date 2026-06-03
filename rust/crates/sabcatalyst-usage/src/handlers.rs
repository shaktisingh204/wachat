use axum::{
    Json,
    extract::{Query, State},
    http::StatusCode,
};
use bson::{Document, doc, oid::ObjectId, to_bson};
use chrono::Utc;
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json};
use serde_json::Value;
use tracing::instrument;

use crate::USAGE_COLL;
use crate::dto::{GetUsageQuery, IncrementUsageBody, UsageRollupResponse};
use crate::state::SabcatalystUsageState;

fn owner_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("user claim not a valid ObjectId".into()))
}

#[instrument(skip_all)]
pub async fn get_usage(
    user: AuthUser,
    State(state): State<SabcatalystUsageState>,
    Query(q): Query<GetUsageQuery>,
) -> Result<Json<UsageRollupResponse>> {
    let owner = owner_oid(&user)?;
    let project = oid_from_str(&q.project_id)?;
    let period_bson = to_bson(&q.period).unwrap_or_else(|_| bson::Bson::String("monthly".into()));
    let mut filter = doc! { "userId": owner, "projectId": project, "period": period_bson };
    if let Some(pk) = q.period_key.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("periodKey", pk);
    }
    let opts = FindOptions::builder()
        .sort(doc! { "periodKey": -1 })
        .limit(60)
        .build();
    let cur = state
        .mongo
        .collection::<Document>(USAGE_COLL)
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("usage.find")))?;
    let docs: Vec<Document> = cur
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("usage.collect")))?;
    Ok(Json(UsageRollupResponse {
        rows: docs.into_iter().map(document_to_clean_json).collect(),
    }))
}

/// Idempotent atomic increment — upserts the (projectId, period,
/// periodKey) row and `$inc`'s the supplied counters. Designed to be
/// called from the executor / invocation-log writer.
#[instrument(skip_all)]
pub async fn increment_usage(
    user: AuthUser,
    State(state): State<SabcatalystUsageState>,
    Json(body): Json<IncrementUsageBody>,
) -> Result<(StatusCode, Json<Value>)> {
    let owner = owner_oid(&user)?;
    let project = oid_from_str(&body.project_id)?;
    let period_bson =
        to_bson(&body.period).unwrap_or_else(|_| bson::Bson::String("monthly".into()));
    let mut inc = Document::new();
    if let Some(v) = body.function_invocations {
        inc.insert("functionInvocations", v);
    }
    if let Some(v) = body.function_billable_ms {
        inc.insert("functionBillableMs", v);
    }
    if let Some(v) = body.datastore_reads {
        inc.insert("datastoreReads", v);
    }
    if let Some(v) = body.datastore_writes {
        inc.insert("datastoreWrites", v);
    }
    if let Some(v) = body.file_storage_bytes {
        inc.insert("fileStorageBytes", v);
    }
    if let Some(v) = body.bandwidth_bytes {
        inc.insert("bandwidthBytes", v);
    }
    let set = doc! {
        "userId": owner, "projectId": project,
        "period": period_bson.clone(),
        "periodKey": &body.period_key,
        "updatedAt": bson::DateTime::from_chrono(Utc::now()),
    };
    let coll = state.mongo.collection::<Document>(USAGE_COLL);
    let update = if inc.is_empty() {
        doc! { "$set": set }
    } else {
        doc! { "$set": set, "$inc": inc }
    };
    coll.update_one(
        doc! {
            "userId": owner,
            "projectId": project,
            "period": period_bson,
            "periodKey": &body.period_key,
        },
        update,
    )
    .upsert(true)
    .await
    .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("usage.upsert")))?;
    Ok((
        StatusCode::ACCEPTED,
        Json(serde_json::json!({ "ok": true })),
    ))
}
