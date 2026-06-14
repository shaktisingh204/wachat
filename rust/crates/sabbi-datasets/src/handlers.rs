//! HTTP handlers for the SabBI Dataset entity.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_common::{
    pagination::{clamp_limit, skip_for},
    search::build_q_filter,
    tenant::tenant_oid as user_oid,
};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    CreateDatasetInput, CreateDatasetResponse, DeleteDatasetResponse, ListQuery, PreviewResponse,
    UpdateDatasetInput,
};
use crate::types::BiDataset;

pub(crate) const COLL: &str = "sabbi_datasets";

fn list_filter(user_id: ObjectId, status: Option<&str>, source: Option<&str>) -> Document {
    let mut filter = doc! { "userId": user_id };
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
    if let Some(s) = source.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("source", s);
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn validate_source(source: &str) -> Result<()> {
    match source {
        "csv_upload" | "mongo_collection" | "rest_api" => Ok(()),
        other => Err(ApiError::Validation(format!(
            "unsupported source '{other}' (expected csv_upload | mongo_collection | rest_api)"
        ))),
    }
}

fn dataset_from_create(input: CreateDatasetInput, user_id: ObjectId) -> Result<BiDataset> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    validate_source(&input.source)?;
    Ok(BiDataset {
        id: None,
        user_id,
        name: input.name.trim().to_owned(),
        description: input
            .description
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty()),
        source: input.source,
        file_id: input.file_id,
        collection_name: input.collection_name,
        rest_url: input.rest_url,
        schema_json: input.schema_json,
        row_count: input.row_count,
        last_refresh_at: None,
        status: "active".to_owned(),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateDatasetInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch
        .name
        .map(|s| s.trim().to_owned())
        .filter(|s| !s.is_empty())
    {
        set.insert("name", v);
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.file_id {
        set.insert("fileId", v);
    }
    if let Some(v) = patch.collection_name {
        set.insert("collectionName", v);
    }
    if let Some(v) = patch.rest_url {
        set.insert("restUrl", v);
    }
    if let Some(v) = patch.schema_json {
        set.insert("schemaJson", v);
    }
    if let Some(v) = patch.row_count {
        set.insert("rowCount", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    doc! { "$set": set }
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<BiDataset>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_datasets(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref(), q.source.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "description"]);
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
    let coll = mongo.collection::<BiDataset>(COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabbi_datasets.find"))
        })?;
    let mut rows: Vec<BiDataset> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabbi_datasets.collect")))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %dataset_id))]
pub async fn get_dataset(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(dataset_id): Path<String>,
) -> Result<Json<BiDataset>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&dataset_id)?;
    let coll = mongo.collection::<BiDataset>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabbi_datasets.find_one")))?
        .ok_or_else(|| ApiError::NotFound("dataset".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_dataset(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateDatasetInput>,
) -> Result<Json<CreateDatasetResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = dataset_from_create(input, user_id)?;
    let coll = mongo.collection::<BiDataset>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabbi_datasets.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(CreateDatasetResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %dataset_id))]
pub async fn update_dataset(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(dataset_id): Path<String>,
    Json(patch): Json<UpdateDatasetInput>,
) -> Result<Json<BiDataset>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&dataset_id)?;
    let coll = mongo.collection::<BiDataset>(COLL);
    if let Some(name) = patch.name.as_deref()
        && name.trim().is_empty()
    {
        return Err(ApiError::Validation("name cannot be empty".to_owned()));
    }
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabbi_datasets.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("dataset".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabbi_datasets.refetch")))?
        .ok_or_else(|| ApiError::NotFound("dataset".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %dataset_id))]
pub async fn delete_dataset(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(dataset_id): Path<String>,
) -> Result<Json<DeleteDatasetResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&dataset_id)?;
    let coll = mongo.collection::<BiDataset>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabbi_datasets.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("dataset".to_owned()));
    }
    Ok(Json(DeleteDatasetResponse { deleted: true }))
}

/// Refresh a dataset — bumps `lastRefreshAt` and (for `mongo_collection`)
/// recomputes `rowCount` against the linked collection.
///
/// TODO: for `csv_upload`, fetch the file from SabFiles via the sabfiles
/// crate, parse rows, and update `schemaJson` + `rowCount`. For `rest_api`,
/// issue an HTTP GET and store materialised rows. Both are deferred until
/// the BI query exec module lands.
#[instrument(skip_all, fields(user_id = %user.user_id, id = %dataset_id))]
pub async fn refresh_dataset(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(dataset_id): Path<String>,
) -> Result<Json<BiDataset>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&dataset_id)?;
    let coll = mongo.collection::<BiDataset>(COLL);
    let entity = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabbi_datasets.find_one")))?
        .ok_or_else(|| ApiError::NotFound("dataset".to_owned()))?;

    let mut row_count: Option<i64> = entity.row_count;
    if entity.source == "mongo_collection"
        && let Some(coll_name) = entity.collection_name.as_deref()
        && !coll_name.is_empty()
    {
        let coll_ref = mongo.collection::<Document>(coll_name);
        if let Ok(c) = coll_ref.count_documents(doc! { "userId": user_id }).await {
            row_count = Some(c as i64);
        }
    }

    let now = BsonDateTime::from_chrono(Utc::now());
    let mut set = doc! { "lastRefreshAt": now, "updatedAt": now };
    if let Some(c) = row_count {
        set.insert("rowCount", c);
    }
    coll.update_one(ownership_filter(user_id, oid), doc! { "$set": set })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabbi_datasets.refresh")))?;
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabbi_datasets.refetch")))?
        .ok_or_else(|| ApiError::NotFound("dataset".to_owned()))?;
    Ok(Json(after))
}

/// Preview up to 50 rows from the dataset.
///
/// Only implemented for `mongo_collection`. `csv_upload` and `rest_api`
/// previews are deferred — TODO once the SabFiles fetch helper and a
/// CSV parser dependency are wired.
#[instrument(skip_all, fields(user_id = %user.user_id, id = %dataset_id))]
pub async fn preview_dataset(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(dataset_id): Path<String>,
) -> Result<Json<PreviewResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&dataset_id)?;
    let coll = mongo.collection::<BiDataset>(COLL);
    let entity = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabbi_datasets.find_one")))?
        .ok_or_else(|| ApiError::NotFound("dataset".to_owned()))?;

    if entity.source != "mongo_collection" {
        // Deferred — see TODO above.
        return Ok(Json(PreviewResponse {
            rows: vec![],
            row_count: entity.row_count.unwrap_or(0),
            columns: vec![],
        }));
    }
    let coll_name = entity
        .collection_name
        .as_deref()
        .ok_or_else(|| ApiError::Validation("collectionName missing".to_owned()))?;
    let target = mongo.collection::<Document>(coll_name);
    let opts = FindOptions::builder().limit(50).build();
    let cursor = target
        .find(doc! { "userId": user_id })
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabbi_datasets.preview.find"))
        })?;
    let rows: Vec<Document> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabbi_datasets.preview.collect"))
    })?;
    let columns: Vec<String> = rows
        .first()
        .map(|r| r.keys().map(String::from).collect())
        .unwrap_or_default();
    let row_count = target
        .count_documents(doc! { "userId": user_id })
        .await
        .unwrap_or(0) as i64;
    Ok(Json(PreviewResponse {
        rows,
        row_count,
        columns,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_invalid_source() {
        assert!(validate_source("xyz").is_err());
        assert!(validate_source("csv_upload").is_ok());
        assert!(validate_source("mongo_collection").is_ok());
        assert!(validate_source("rest_api").is_ok());
    }

    #[test]
    fn dataset_from_create_sets_defaults() {
        let uid = ObjectId::new();
        let d = dataset_from_create(
            CreateDatasetInput {
                name: "Sales 2026".into(),
                source: "csv_upload".into(),
                ..Default::default()
            },
            uid,
        )
        .unwrap();
        assert_eq!(d.status, "active");
        assert_eq!(d.source, "csv_upload");
        assert!(d.last_refresh_at.is_none());
    }
}
