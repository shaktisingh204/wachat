//! HTTP handlers for the SabBI Dataset Join entity.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_common::{
    pagination::{clamp_limit, skip_for},
    tenant::user_oid,
};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    CreateJoinInput, CreateJoinResponse, DeleteJoinResponse, ListQuery, UpdateJoinInput,
};
use crate::types::BiDatasetJoin;

pub(crate) const COLL: &str = "sabbi_dataset_joins";

fn validate_join_type(value: &str) -> Result<()> {
    match value {
        "inner" | "left" | "right" | "outer" => Ok(()),
        other => Err(ApiError::Validation(format!(
            "unsupported join type '{other}'"
        ))),
    }
}

fn list_filter(
    user_id: ObjectId,
    status: Option<&str>,
    left_id: Option<&str>,
    right_id: Option<&str>,
) -> Document {
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
    if let Some(s) = left_id.and_then(|s| ObjectId::parse_str(s).ok()) {
        filter.insert("leftId", s);
    }
    if let Some(s) = right_id.and_then(|s| ObjectId::parse_str(s).ok()) {
        filter.insert("rightId", s);
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn join_from_create(input: CreateJoinInput, user_id: ObjectId) -> Result<BiDatasetJoin> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    let left_id = ObjectId::parse_str(&input.left_id)
        .map_err(|_| ApiError::Validation("leftId is not a valid ObjectId".to_owned()))?;
    let right_id = ObjectId::parse_str(&input.right_id)
        .map_err(|_| ApiError::Validation("rightId is not a valid ObjectId".to_owned()))?;
    let join_type = input.join_type.unwrap_or_else(|| "inner".to_owned());
    validate_join_type(&join_type)?;
    Ok(BiDatasetJoin {
        id: None,
        user_id,
        name: input.name.trim().to_owned(),
        left_id,
        right_id,
        join_type,
        on_columns: input.on_columns,
        status: "active".to_owned(),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateJoinInput) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name.map(|s| s.trim().to_owned()).filter(|s| !s.is_empty()) {
        set.insert("name", v);
    }
    if let Some(v) = patch.left_id.as_deref().and_then(|s| ObjectId::parse_str(s).ok()) {
        set.insert("leftId", v);
    }
    if let Some(v) = patch.right_id.as_deref().and_then(|s| ObjectId::parse_str(s).ok()) {
        set.insert("rightId", v);
    }
    if let Some(v) = patch.join_type {
        validate_join_type(&v)?;
        set.insert("type", v);
    }
    if let Some(v) = patch.on_columns {
        let arr: Vec<Document> = v
            .into_iter()
            .map(|c| doc! { "left": c.left, "right": c.right })
            .collect();
        set.insert("onColumns", arr);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    Ok(doc! { "$set": set })
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<BiDatasetJoin>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_joins(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let filter = list_filter(
        user_id,
        q.status.as_deref(),
        q.left_id.as_deref(),
        q.right_id.as_deref(),
    );
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<BiDatasetJoin>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabbi_dataset_joins.find")))?;
    let mut rows: Vec<BiDatasetJoin> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabbi_dataset_joins.collect")))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %join_id))]
pub async fn get_join(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(join_id): Path<String>,
) -> Result<Json<BiDatasetJoin>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&join_id)?;
    let coll = mongo.collection::<BiDatasetJoin>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabbi_dataset_joins.find_one")))?
        .ok_or_else(|| ApiError::NotFound("join".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_join(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateJoinInput>,
) -> Result<Json<CreateJoinResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = join_from_create(input, user_id)?;
    let coll = mongo.collection::<BiDatasetJoin>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabbi_dataset_joins.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(CreateJoinResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %join_id))]
pub async fn update_join(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(join_id): Path<String>,
    Json(patch): Json<UpdateJoinInput>,
) -> Result<Json<BiDatasetJoin>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&join_id)?;
    let coll = mongo.collection::<BiDatasetJoin>(COLL);
    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabbi_dataset_joins.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("join".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabbi_dataset_joins.refetch")))?
        .ok_or_else(|| ApiError::NotFound("join".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %join_id))]
pub async fn delete_join(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(join_id): Path<String>,
) -> Result<Json<DeleteJoinResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&join_id)?;
    let coll = mongo.collection::<BiDatasetJoin>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabbi_dataset_joins.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("join".to_owned()));
    }
    Ok(Json(DeleteJoinResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_invalid_join_type() {
        assert!(validate_join_type("cross").is_err());
        for t in ["inner", "left", "right", "outer"] {
            assert!(validate_join_type(t).is_ok());
        }
    }
}
