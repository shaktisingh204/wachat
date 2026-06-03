use axum::{
    Json,
    extract::{Path, Query, State},
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

use crate::RECORDS_COLL;
use crate::dto::{
    CreateRecordBody, ListRecordsQuery, ListRecordsResponse, MAX_LIMIT, UpdateRecordBody,
};
use crate::state::SabcatalystRecordsState;

fn owner_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("user claim not a valid ObjectId".into()))
}

#[instrument(skip_all)]
pub async fn list_records(
    user: AuthUser,
    State(state): State<SabcatalystRecordsState>,
    Query(q): Query<ListRecordsQuery>,
) -> Result<Json<ListRecordsResponse>> {
    let owner = owner_oid(&user)?;
    let table = oid_from_str(&q.table_id)?;
    let mut filter = doc! { "userId": owner, "tableId": table };
    if let Some(c) = q.cursor.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("_id", doc! { "$lt": oid_from_str(c)? });
    }
    let limit = q.limit.clamp(1, MAX_LIMIT);
    let opts = FindOptions::builder()
        .sort(doc! { "_id": -1 })
        .limit(limit)
        .build();
    let cur = state
        .mongo
        .collection::<Document>(RECORDS_COLL)
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("records.find")))?;
    let docs: Vec<Document> = cur
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("records.collect")))?;
    let next_cursor = if (docs.len() as i64) < limit {
        None
    } else {
        docs.last()
            .and_then(|d| d.get_object_id("_id").ok())
            .map(|o| o.to_hex())
    };
    Ok(Json(ListRecordsResponse {
        items: docs.into_iter().map(document_to_clean_json).collect(),
        next_cursor,
    }))
}

#[instrument(skip_all)]
pub async fn get_record(
    user: AuthUser,
    State(state): State<SabcatalystRecordsState>,
    Path(id): Path<String>,
) -> Result<Json<Value>> {
    let owner = owner_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let d = state
        .mongo
        .collection::<Document>(RECORDS_COLL)
        .find_one(doc! { "_id": oid, "userId": owner })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("records.find_one")))?
        .ok_or_else(|| ApiError::NotFound("Record not found.".into()))?;
    Ok(Json(document_to_clean_json(d)))
}

#[instrument(skip_all)]
pub async fn create_record(
    user: AuthUser,
    State(state): State<SabcatalystRecordsState>,
    Json(body): Json<CreateRecordBody>,
) -> Result<(StatusCode, Json<Value>)> {
    let owner = owner_oid(&user)?;
    let table = oid_from_str(&body.table_id)?;
    let project = oid_from_str(&body.project_id)?;
    let data = to_bson(&body.data_json)
        .map_err(|e| ApiError::BadRequest(format!("invalid dataJson: {e}")))?;
    let now = Utc::now();
    let d = doc! {
        "_id": ObjectId::new(),
        "userId": owner, "projectId": project, "tableId": table,
        "dataJson": data,
        "createdAt": bson::DateTime::from_chrono(now),
        "updatedAt": bson::DateTime::from_chrono(now),
    };
    state
        .mongo
        .collection::<Document>(RECORDS_COLL)
        .insert_one(&d)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("records.insert")))?;
    Ok((StatusCode::CREATED, Json(document_to_clean_json(d))))
}

#[instrument(skip_all)]
pub async fn update_record(
    user: AuthUser,
    State(state): State<SabcatalystRecordsState>,
    Path(id): Path<String>,
    Json(body): Json<UpdateRecordBody>,
) -> Result<Json<Value>> {
    let owner = owner_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let data = to_bson(&body.data_json)
        .map_err(|e| ApiError::BadRequest(format!("invalid dataJson: {e}")))?;
    let d = state.mongo.collection::<Document>(RECORDS_COLL)
        .find_one_and_update(
            doc! { "_id": oid, "userId": owner },
            doc! { "$set": { "dataJson": data, "updatedAt": bson::DateTime::from_chrono(Utc::now()) } },
        ).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("records.update")))?
        .ok_or_else(|| ApiError::NotFound("Record not found.".into()))?;
    Ok(Json(document_to_clean_json(d)))
}

#[instrument(skip_all)]
pub async fn delete_record(
    user: AuthUser,
    State(state): State<SabcatalystRecordsState>,
    Path(id): Path<String>,
) -> Result<StatusCode> {
    let owner = owner_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let r = state
        .mongo
        .collection::<Document>(RECORDS_COLL)
        .delete_one(doc! { "_id": oid, "userId": owner })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("records.delete")))?;
    if r.deleted_count == 0 {
        return Err(ApiError::NotFound("Record not found.".into()));
    }
    Ok(StatusCode::NO_CONTENT)
}
