//! HTTP handlers for SabSheet version history.

use axum::{
    Json,
    extract::{Query, State},
};
use bson::{DateTime as BsonDateTime, doc, oid::ObjectId};
use chrono::Utc;
use crm_common::tenant::user_oid;
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    CreateVersionInput, CreateVersionResponse, ListQuery, ListResponse, RestoreVersionInput,
    RestoreVersionResponse,
};
use crate::types::SabsheetVersion;

pub(crate) const COLL: &str = "sabsheet_versions";

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_versions(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let wb = oid_from_str(&q.workbook_id)?;
    let coll = mongo.collection::<SabsheetVersion>(COLL);
    let limit = q.limit.unwrap_or(50).min(200) as i64;
    let opts = FindOptions::builder()
        .sort(doc! { "version": -1 })
        .limit(limit)
        .build();
    let cursor = coll
        .find(doc! { "workbookId": wb, "ownerUserId": user_id })
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabsheet_versions.find")))?;
    let items: Vec<SabsheetVersion> = cursor.try_collect().await.unwrap_or_default();
    Ok(Json(ListResponse { items }))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_version(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateVersionInput>,
) -> Result<Json<CreateVersionResponse>> {
    let user_id = user_oid(&user)?;
    let wb = oid_from_str(&input.workbook_id)?;
    // Find the latest version number.
    let coll = mongo.collection::<SabsheetVersion>(COLL);
    let opts = FindOptions::builder()
        .sort(doc! { "version": -1 })
        .limit(1)
        .build();
    let last_cursor = coll
        .find(doc! { "workbookId": wb, "ownerUserId": user_id })
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabsheet_versions.last")))?;
    let last: Vec<SabsheetVersion> = last_cursor.try_collect().await.unwrap_or_default();
    let next_version = last.first().map(|v| v.version + 1).unwrap_or(1);
    let snapshot_file_id = input
        .snapshot_file_id
        .and_then(|s| ObjectId::parse_str(&s).ok());

    let mut entity = SabsheetVersion {
        id: None,
        workbook_id: wb,
        owner_user_id: user_id,
        version: next_version,
        saved_at: BsonDateTime::from_chrono(Utc::now()),
        saved_by: user_id,
        comment: input
            .comment
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty()),
        snapshot_file_id,
    };
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabsheet_versions.insert"))
    })?;
    let id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id not ObjectId")))?;
    entity.id = Some(id);
    Ok(Json(CreateVersionResponse {
        id: id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn restore_version(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<RestoreVersionInput>,
) -> Result<Json<RestoreVersionResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&input.version_id)?;
    let coll = mongo.collection::<SabsheetVersion>(COLL);
    let row = coll
        .find_one(doc! { "_id": oid, "ownerUserId": user_id })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabsheet_versions.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("version".to_owned()))?;
    // TODO: actually load the snapshot blob from SabFiles and replay it
    // into sabsheet_cells / sabsheet_sheets. For now we just record the
    // restore intent — the TS side is responsible for the replay until the
    // snapshot dump format is finalized.
    Ok(Json(RestoreVersionResponse {
        restored: true,
        workbook_id: row.workbook_id.to_hex(),
    }))
}
