//! HTTP handlers for SabSheet sheets.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_common::tenant::user_oid;
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    CreateSheetInput, CreateSheetResponse, DeleteSheetResponse, ListQuery, ListResponse,
    UpdateSheetInput,
};
use crate::types::SabsheetSheet;

pub(crate) const COLL: &str = "sabsheet_sheets";

fn from_create(input: CreateSheetInput, user_id: ObjectId) -> Result<SabsheetSheet> {
    let name = input.name.trim();
    if name.is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    let workbook_id = oid_from_str(&input.workbook_id)?;
    Ok(SabsheetSheet {
        id: None,
        workbook_id,
        owner_user_id: user_id,
        name: name.to_owned(),
        position: input.position.unwrap_or(0),
        row_count: input.row_count.unwrap_or(1000),
        col_count: input.col_count.unwrap_or(26),
        frozen_rows: 0,
        frozen_cols: 0,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateSheetInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch
        .name
        .map(|s| s.trim().to_owned())
        .filter(|s| !s.is_empty())
    {
        set.insert("name", v);
    }
    if let Some(v) = patch.position {
        set.insert("position", v as i64);
    }
    if let Some(v) = patch.row_count {
        set.insert("rowCount", v as i64);
    }
    if let Some(v) = patch.col_count {
        set.insert("colCount", v as i64);
    }
    if let Some(v) = patch.frozen_rows {
        set.insert("frozenRows", v as i64);
    }
    if let Some(v) = patch.frozen_cols {
        set.insert("frozenCols", v as i64);
    }
    doc! { "$set": set }
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_sheets(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let workbook_id = oid_from_str(&q.workbook_id)?;
    let coll = mongo.collection::<SabsheetSheet>(COLL);
    let filter = doc! { "workbookId": workbook_id, "ownerUserId": user_id };
    let opts = FindOptions::builder()
        .sort(doc! { "position": 1, "createdAt": 1 })
        .build();
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabsheet_sheets.find"))
        })?;
    let items: Vec<SabsheetSheet> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabsheet_sheets.collect"))
    })?;
    Ok(Json(ListResponse { items }))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_sheet(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateSheetInput>,
) -> Result<Json<CreateSheetResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = from_create(input, user_id)?;
    let coll = mongo.collection::<SabsheetSheet>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabsheet_sheets.insert")))?;
    let id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id not ObjectId")))?;
    entity.id = Some(id);
    Ok(Json(CreateSheetResponse {
        id: id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %sheet_id))]
pub async fn get_sheet(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(sheet_id): Path<String>,
) -> Result<Json<SabsheetSheet>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&sheet_id)?;
    let coll = mongo.collection::<SabsheetSheet>(COLL);
    let row = coll
        .find_one(doc! { "_id": oid, "ownerUserId": user_id })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabsheet_sheets.find_one")))?
        .ok_or_else(|| ApiError::NotFound("sheet".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %sheet_id))]
pub async fn update_sheet(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(sheet_id): Path<String>,
    Json(patch): Json<UpdateSheetInput>,
) -> Result<Json<SabsheetSheet>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&sheet_id)?;
    let coll = mongo.collection::<SabsheetSheet>(COLL);
    let filter = doc! { "_id": oid, "ownerUserId": user_id };
    let update = build_update_doc(patch);
    let result = coll
        .update_one(filter.clone(), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabsheet_sheets.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("sheet".to_owned()));
    }
    let after = coll
        .find_one(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabsheet_sheets.refetch")))?
        .ok_or_else(|| ApiError::NotFound("sheet".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %sheet_id))]
pub async fn delete_sheet(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(sheet_id): Path<String>,
) -> Result<Json<DeleteSheetResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&sheet_id)?;
    let coll = mongo.collection::<SabsheetSheet>(COLL);
    let result = coll
        .delete_one(doc! { "_id": oid, "ownerUserId": user_id })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabsheet_sheets.delete")))?;
    if result.deleted_count == 0 {
        return Err(ApiError::NotFound("sheet".to_owned()));
    }
    Ok(Json(DeleteSheetResponse { deleted: true }))
}
