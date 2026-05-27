use axum::{Json, extract::{Query, State}, http::StatusCode};
use bson::{Document, doc, oid::ObjectId, to_bson};
use chrono::Utc;
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json};
use serde_json::Value;
use tracing::instrument;

use crate::INVOCATIONS_COLL;
use crate::dto::{ListInvocationsQuery, ListInvocationsResponse, MAX_LIMIT, RecordInvocationBody};
use crate::state::SabcatalystInvocationsState;

fn owner_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("user claim not a valid ObjectId".into()))
}

#[instrument(skip_all)]
pub async fn list_invocations(
    user: AuthUser,
    State(state): State<SabcatalystInvocationsState>,
    Query(q): Query<ListInvocationsQuery>,
) -> Result<Json<ListInvocationsResponse>> {
    let owner = owner_oid(&user)?;
    let func = oid_from_str(&q.function_id)?;
    let mut filter = doc! { "userId": owner, "functionId": func };
    if let Some(c) = q.cursor.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("_id", doc! { "$lt": oid_from_str(c)? });
    }
    let limit = q.limit.clamp(1, MAX_LIMIT);
    let opts = FindOptions::builder().sort(doc! { "_id": -1 }).limit(limit).build();
    let cur = state.mongo.collection::<Document>(INVOCATIONS_COLL)
        .find(filter).with_options(opts).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("invocations.find")))?;
    let docs: Vec<Document> = cur.try_collect().await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("invocations.collect")))?;
    let next_cursor = if (docs.len() as i64) < limit { None } else {
        docs.last().and_then(|d| d.get_object_id("_id").ok()).map(|o| o.to_hex())
    };
    let items: Vec<Value> = docs.into_iter().map(document_to_clean_json).collect();
    Ok(Json(ListInvocationsResponse { items, next_cursor }))
}

#[instrument(skip_all)]
pub async fn record_invocation(
    user: AuthUser,
    State(state): State<SabcatalystInvocationsState>,
    Json(body): Json<RecordInvocationBody>,
) -> Result<(StatusCode, Json<Value>)> {
    let owner = owner_oid(&user)?;
    let func = oid_from_str(&body.function_id)?;
    let project = oid_from_str(&body.project_id)?;
    let now = Utc::now();
    let status_bson = to_bson(&body.status).unwrap_or_else(|_| bson::Bson::String("success".into()));
    let mut d = doc! {
        "_id": ObjectId::new(),
        "userId": owner,
        "projectId": project,
        "functionId": func,
        "ts": bson::DateTime::from_chrono(now),
        "durationMs": body.duration_ms as i64,
        "status": status_bson,
        "requestSizeBytes": body.request_size_bytes as i64,
        "responseSizeBytes": body.response_size_bytes as i64,
        "billableMs": body.billable_ms as i64,
    };
    if let Some(e) = body.error_message { d.insert("errorMessage", e); }
    state.mongo.collection::<Document>(INVOCATIONS_COLL).insert_one(&d).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("invocations.insert")))?;
    Ok((StatusCode::CREATED, Json(document_to_clean_json(d))))
}
