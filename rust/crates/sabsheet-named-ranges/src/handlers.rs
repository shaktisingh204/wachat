//! HTTP handlers for SabSheet named ranges.

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
    CreateNamedRangeInput, CreateNamedRangeResponse, DeleteResponse, ListQuery, ListResponse,
    UpdateNamedRangeInput,
};
use crate::types::SabsheetNamedRange;

pub(crate) const COLL: &str = "sabsheet_named_ranges";

fn from_create(input: CreateNamedRangeInput, user_id: ObjectId) -> Result<SabsheetNamedRange> {
    let name = input.name.trim();
    if name.is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    Ok(SabsheetNamedRange {
        id: None,
        workbook_id: oid_from_str(&input.workbook_id)?,
        owner_user_id: user_id,
        name: name.to_owned(),
        sheet_id: oid_from_str(&input.sheet_id)?,
        start_row: input.start_row,
        start_col: input.start_col,
        end_row: input.end_row,
        end_col: input.end_col,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update(patch: UpdateNamedRangeInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name.map(|s| s.trim().to_owned()).filter(|s| !s.is_empty()) {
        set.insert("name", v);
    }
    if let Some(v) = patch.sheet_id.and_then(|s| ObjectId::parse_str(&s).ok()) {
        set.insert("sheetId", v);
    }
    if let Some(v) = patch.start_row {
        set.insert("startRow", v as i64);
    }
    if let Some(v) = patch.start_col {
        set.insert("startCol", v as i64);
    }
    if let Some(v) = patch.end_row {
        set.insert("endRow", v as i64);
    }
    if let Some(v) = patch.end_col {
        set.insert("endCol", v as i64);
    }
    doc! { "$set": set }
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_named_ranges(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let wb = oid_from_str(&q.workbook_id)?;
    let coll = mongo.collection::<SabsheetNamedRange>(COLL);
    let cursor = coll
        .find(doc! { "workbookId": wb, "ownerUserId": user_id })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabsheet_named_ranges.find")))?;
    let items: Vec<SabsheetNamedRange> = cursor.try_collect().await.unwrap_or_default();
    Ok(Json(ListResponse { items }))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_named_range(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateNamedRangeInput>,
) -> Result<Json<CreateNamedRangeResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = from_create(input, user_id)?;
    let coll = mongo.collection::<SabsheetNamedRange>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabsheet_named_ranges.insert")))?;
    let id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id not ObjectId")))?;
    entity.id = Some(id);
    Ok(Json(CreateNamedRangeResponse { id: id.to_hex(), entity }))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn update_named_range(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(patch): Json<UpdateNamedRangeInput>,
) -> Result<Json<SabsheetNamedRange>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabsheetNamedRange>(COLL);
    let filter = doc! { "_id": oid, "ownerUserId": user_id };
    coll.update_one(filter.clone(), build_update(patch))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabsheet_named_ranges.update")))?;
    let after = coll
        .find_one(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabsheet_named_ranges.refetch")))?
        .ok_or_else(|| ApiError::NotFound("named_range".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn delete_named_range(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<DeleteResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabsheetNamedRange>(COLL);
    let r = coll
        .delete_one(doc! { "_id": oid, "ownerUserId": user_id })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabsheet_named_ranges.delete")))?;
    if r.deleted_count == 0 {
        return Err(ApiError::NotFound("named_range".to_owned()));
    }
    Ok(Json(DeleteResponse { deleted: true }))
}
