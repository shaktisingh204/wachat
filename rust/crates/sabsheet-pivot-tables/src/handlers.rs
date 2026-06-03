//! HTTP handlers for SabSheet pivot tables.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_common::tenant::user_oid;
use futures::TryStreamExt;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    CreatePivotInput, CreatePivotResponse, DeleteResponse, ListQuery, ListResponse,
    UpdatePivotInput,
};
use crate::types::SabsheetPivotTable;

pub(crate) const COLL: &str = "sabsheet_pivot_tables";

fn from_create(input: CreatePivotInput, user_id: ObjectId) -> Result<SabsheetPivotTable> {
    let name = input.name.trim();
    if name.is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    Ok(SabsheetPivotTable {
        id: None,
        sheet_id: oid_from_str(&input.sheet_id)?,
        workbook_id: oid_from_str(&input.workbook_id)?,
        owner_user_id: user_id,
        name: name.to_owned(),
        source_range: input.source_range,
        config_json: input.config_json,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update(patch: UpdatePivotInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch
        .name
        .map(|s| s.trim().to_owned())
        .filter(|s| !s.is_empty())
    {
        set.insert("name", v);
    }
    if let Some(v) = patch.source_range {
        set.insert("sourceRange", v);
    }
    if let Some(v) = patch.config_json {
        set.insert("configJson", v);
    }
    doc! { "$set": set }
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_pivots(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let wb = oid_from_str(&q.workbook_id)?;
    let mut filter = doc! { "workbookId": wb, "ownerUserId": user_id };
    if let Some(sid) = q.sheet_id.and_then(|s| ObjectId::parse_str(&s).ok()) {
        filter.insert("sheetId", sid);
    }
    let coll = mongo.collection::<SabsheetPivotTable>(COLL);
    let cursor = coll.find(filter).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabsheet_pivot_tables.find"))
    })?;
    let items: Vec<SabsheetPivotTable> = cursor.try_collect().await.unwrap_or_default();
    Ok(Json(ListResponse { items }))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_pivot(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreatePivotInput>,
) -> Result<Json<CreatePivotResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = from_create(input, user_id)?;
    let coll = mongo.collection::<SabsheetPivotTable>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabsheet_pivot_tables.insert"))
    })?;
    let id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id not ObjectId")))?;
    entity.id = Some(id);
    Ok(Json(CreatePivotResponse {
        id: id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn update_pivot(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(patch): Json<UpdatePivotInput>,
) -> Result<Json<SabsheetPivotTable>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabsheetPivotTable>(COLL);
    let filter = doc! { "_id": oid, "ownerUserId": user_id };
    coll.update_one(filter.clone(), build_update(patch))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabsheet_pivot_tables.update"))
        })?;
    let after = coll
        .find_one(filter)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabsheet_pivot_tables.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("pivot".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn delete_pivot(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<DeleteResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabsheetPivotTable>(COLL);
    let r = coll
        .delete_one(doc! { "_id": oid, "ownerUserId": user_id })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabsheet_pivot_tables.delete"))
        })?;
    if r.deleted_count == 0 {
        return Err(ApiError::NotFound("pivot".to_owned()));
    }
    Ok(Json(DeleteResponse { deleted: true }))
}
