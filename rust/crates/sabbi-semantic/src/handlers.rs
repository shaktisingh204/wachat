//! HTTP handlers for the SabBI semantic Model entity (`sabbi_models`).

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
    CreateModelInput, CreateModelResponse, DeleteModelResponse, ListQuery, UpdateModelInput,
};
use crate::types::BiModel;

pub(crate) const COLL: &str = "sabbi_models";

fn list_filter(user_id: ObjectId, status: Option<&str>, connector: Option<&str>) -> Document {
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
    if let Some(c) = connector.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("connector", c);
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn model_from_create(input: CreateModelInput, user_id: ObjectId) -> Result<BiModel> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    if input.collection.trim().is_empty() {
        return Err(ApiError::Validation("collection is required".to_owned()));
    }
    Ok(BiModel {
        id: None,
        user_id,
        name: input.name.trim().to_owned(),
        description: input
            .description
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty()),
        collection: input.collection.trim().to_owned(),
        base_filter: input.base_filter,
        scope_field: input.scope_field,
        scope_by: input.scope_by,
        scope_string: input.scope_string,
        measures: input.measures.unwrap_or_default(),
        dimensions: input.dimensions.unwrap_or_default(),
        joins: input.joins.unwrap_or_default(),
        segments: input.segments.unwrap_or_default(),
        source: input.source.unwrap_or_else(|| "manual".to_owned()),
        connector: input.connector,
        status: "active".to_owned(),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateModelInput) -> Result<Document> {
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
    if let Some(v) = patch
        .collection
        .map(|s| s.trim().to_owned())
        .filter(|s| !s.is_empty())
    {
        set.insert("collection", v);
    }
    if let Some(v) = patch.base_filter {
        set.insert("baseFilter", v);
    }
    if let Some(v) = patch.scope_field {
        set.insert("scopeField", v);
    }
    if let Some(v) = patch.scope_by {
        set.insert("scopeBy", v);
    }
    if let Some(v) = patch.scope_string {
        set.insert("scopeString", v);
    }
    if let Some(v) = patch.measures {
        set.insert(
            "measures",
            bson::to_bson(&v)
                .map_err(|e| ApiError::Validation(format!("invalid measures: {e}")))?,
        );
    }
    if let Some(v) = patch.dimensions {
        set.insert(
            "dimensions",
            bson::to_bson(&v)
                .map_err(|e| ApiError::Validation(format!("invalid dimensions: {e}")))?,
        );
    }
    if let Some(v) = patch.joins {
        set.insert(
            "joins",
            bson::to_bson(&v).map_err(|e| ApiError::Validation(format!("invalid joins: {e}")))?,
        );
    }
    if let Some(v) = patch.segments {
        set.insert(
            "segments",
            bson::to_bson(&v)
                .map_err(|e| ApiError::Validation(format!("invalid segments: {e}")))?,
        );
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    Ok(doc! { "$set": set })
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<BiModel>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_models(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref(), q.connector.as_deref());
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
    let coll = mongo.collection::<BiModel>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabbi_models.find")))?;
    let mut rows: Vec<BiModel> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabbi_models.collect")))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %model_id))]
pub async fn get_model(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(model_id): Path<String>,
) -> Result<Json<BiModel>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&model_id)?;
    let coll = mongo.collection::<BiModel>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabbi_models.find_one")))?
        .ok_or_else(|| ApiError::NotFound("model".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_model(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateModelInput>,
) -> Result<Json<CreateModelResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = model_from_create(input, user_id)?;
    let coll = mongo.collection::<BiModel>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabbi_models.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(CreateModelResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %model_id))]
pub async fn update_model(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(model_id): Path<String>,
    Json(patch): Json<UpdateModelInput>,
) -> Result<Json<BiModel>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&model_id)?;
    let coll = mongo.collection::<BiModel>(COLL);
    if let Some(name) = patch.name.as_deref()
        && name.trim().is_empty()
    {
        return Err(ApiError::Validation("name cannot be empty".to_owned()));
    }
    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabbi_models.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("model".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabbi_models.refetch")))?
        .ok_or_else(|| ApiError::NotFound("model".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %model_id))]
pub async fn delete_model(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(model_id): Path<String>,
) -> Result<Json<DeleteModelResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&model_id)?;
    let coll = mongo.collection::<BiModel>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabbi_models.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("model".to_owned()));
    }
    Ok(Json(DeleteModelResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn model_from_create_requires_name_and_collection() {
        let uid = ObjectId::new();
        assert!(
            model_from_create(
                CreateModelInput {
                    name: "  ".into(),
                    collection: "sabcrm_records".into(),
                    ..Default::default()
                },
                uid,
            )
            .is_err()
        );
        assert!(
            model_from_create(
                CreateModelInput {
                    name: "Pipeline".into(),
                    collection: "".into(),
                    ..Default::default()
                },
                uid,
            )
            .is_err()
        );
    }

    #[test]
    fn model_from_create_sets_defaults() {
        let uid = ObjectId::new();
        let m = model_from_create(
            CreateModelInput {
                name: "Pipeline".into(),
                collection: "sabcrm_records".into(),
                ..Default::default()
            },
            uid,
        )
        .unwrap();
        assert_eq!(m.status, "active");
        assert_eq!(m.source, "manual");
        assert!(m.measures.is_empty());
    }
}
