//! HTTP handlers for SabSheet workbooks.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_common::{
    pagination::{clamp_limit, skip_for},
    search::build_q_filter,
    tenant::user_oid,
};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    CreateWorkbookInput, CreateWorkbookResponse, DeleteWorkbookResponse, ListQuery,
    UpdateWorkbookInput,
};
use crate::types::SabsheetWorkbook;

pub(crate) const COLL: &str = "sabsheet_workbooks";

fn parse_oids(ids: &[String]) -> Vec<ObjectId> {
    ids.iter()
        .filter_map(|s| ObjectId::parse_str(s).ok())
        .collect()
}

fn list_filter(user_id: ObjectId, status: Option<&str>, include_shared: bool) -> Document {
    let mut owner_or_shared = vec![doc! { "ownerUserId": user_id }];
    if include_shared {
        owner_or_shared.push(doc! { "sharedWithUserIds": user_id });
    }
    let mut filter = doc! { "$or": owner_or_shared };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "active" => {
            filter.insert("status", "active");
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "ownerUserId": user_id }
}

fn from_create(input: CreateWorkbookInput, user_id: ObjectId) -> Result<SabsheetWorkbook> {
    let title = input.title.trim();
    if title.is_empty() {
        return Err(ApiError::Validation("title is required".to_owned()));
    }
    Ok(SabsheetWorkbook {
        id: None,
        owner_user_id: user_id,
        title: title.to_owned(),
        shared_with_user_ids: parse_oids(&input.shared_with_user_ids),
        status: "active".to_owned(),
        default_sheet_id: None,
        version: 1,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateWorkbookInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch
        .title
        .map(|s| s.trim().to_owned())
        .filter(|s| !s.is_empty())
    {
        set.insert("title", v);
    }
    if let Some(v) = patch.shared_with_user_ids {
        set.insert("sharedWithUserIds", parse_oids(&v));
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    if let Some(v) = patch
        .default_sheet_id
        .and_then(|s| ObjectId::parse_str(&s).ok())
    {
        set.insert("defaultSheetId", v);
    }
    doc! { "$set": set, "$inc": { "version": 1 } }
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabsheetWorkbook>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_workbooks(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let include_shared = q.include_shared.unwrap_or(true);
    let mut filter = list_filter(user_id, q.status.as_deref(), include_shared);
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["title"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<SabsheetWorkbook>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabsheet_workbooks.find"))
    })?;
    let mut rows: Vec<SabsheetWorkbook> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabsheet_workbooks.collect"))
    })?;
    let has_more = rows.len() as i64 > limit;
    if has_more {
        rows.truncate(limit as usize);
    }
    Ok(Json(ListResponse {
        items: rows,
        page: q.page.unwrap_or(0),
        limit: limit as u32,
        has_more,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %workbook_id))]
pub async fn get_workbook(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(workbook_id): Path<String>,
) -> Result<Json<SabsheetWorkbook>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&workbook_id)?;
    let coll = mongo.collection::<SabsheetWorkbook>(COLL);
    // Owner OR shared-with read access.
    let filter = doc! {
        "_id": oid,
        "$or": [
            { "ownerUserId": user_id },
            { "sharedWithUserIds": user_id },
        ],
    };
    let row = coll
        .find_one(filter)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabsheet_workbooks.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("workbook".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_workbook(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateWorkbookInput>,
) -> Result<Json<CreateWorkbookResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = from_create(input, user_id)?;
    let coll = mongo.collection::<SabsheetWorkbook>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabsheet_workbooks.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(CreateWorkbookResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %workbook_id))]
pub async fn update_workbook(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(workbook_id): Path<String>,
    Json(patch): Json<UpdateWorkbookInput>,
) -> Result<Json<SabsheetWorkbook>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&workbook_id)?;
    let coll = mongo.collection::<SabsheetWorkbook>(COLL);
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabsheet_workbooks.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("workbook".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabsheet_workbooks.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("workbook".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %workbook_id))]
pub async fn delete_workbook(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(workbook_id): Path<String>,
) -> Result<Json<DeleteWorkbookResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&workbook_id)?;
    let coll = mongo.collection::<SabsheetWorkbook>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }, "$inc": { "version": 1 } },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabsheet_workbooks.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("workbook".to_owned()));
    }
    Ok(Json(DeleteWorkbookResponse { deleted: true }))
}
