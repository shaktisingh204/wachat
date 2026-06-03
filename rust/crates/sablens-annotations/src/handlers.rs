//! HTTP handlers for SabLens annotations.

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
    CreateAnnotationInput, CreateAnnotationResponse, DeleteAnnotationResponse, ListQuery,
};
use crate::types::SablensAnnotation;

const COLL: &str = "sablens_annotations";

fn is_valid_kind(k: &str) -> bool {
    matches!(k, "arrow" | "circle" | "rect" | "freehand" | "text")
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SablensAnnotation>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_annotations(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = doc! { "userId": user_id };
    if let Some(s) = q.session_id.as_deref().filter(|s| !s.is_empty()) {
        let oid = oid_from_str(s)?;
        filter.insert("sessionId", oid);
    }
    if let Some(k) = q.kind.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("kind", k);
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "ts": 1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<SablensAnnotation>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sablens_annotations.find"))
    })?;
    let mut rows: Vec<SablensAnnotation> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sablens_annotations.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %id))]
pub async fn get_annotation(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<SablensAnnotation>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SablensAnnotation>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sablens_annotations.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("sablens_annotation".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_annotation(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateAnnotationInput>,
) -> Result<Json<CreateAnnotationResponse>> {
    let user_id = user_oid(&user)?;
    if !is_valid_kind(&input.kind) {
        return Err(ApiError::Validation(format!(
            "invalid annotation kind \"{}\"",
            input.kind
        )));
    }
    let session_oid = oid_from_str(&input.session_id)?;
    let now = BsonDateTime::from_chrono(Utc::now());
    let mut entity = SablensAnnotation {
        id: None,
        user_id,
        session_id: session_oid,
        slide_or_frame_id: input.slide_or_frame_id,
        ts: now,
        author_user_id: Some(user_id),
        kind: input.kind,
        geometry_json: input.geometry_json,
        color: input.color.unwrap_or_else(|| "#ef4444".to_owned()),
        stroke_width: input.stroke_width.unwrap_or(3.0),
        persistent: input.persistent.unwrap_or(true),
        created_at: now,
    };
    let coll = mongo.collection::<SablensAnnotation>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sablens_annotations.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(CreateAnnotationResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %id))]
pub async fn delete_annotation(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<DeleteAnnotationResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SablensAnnotation>(COLL);
    let res = coll
        .delete_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sablens_annotations.delete"))
        })?;
    if res.deleted_count == 0 {
        return Err(ApiError::NotFound("sablens_annotation".to_owned()));
    }
    Ok(Json(DeleteAnnotationResponse { deleted: true }))
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClearResponse {
    pub deleted: u64,
}

#[instrument(skip_all, fields(user_id = %user.user_id, sid = %session_id))]
pub async fn clear_session_annotations(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(session_id): Path<String>,
) -> Result<Json<ClearResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&session_id)?;
    let coll = mongo.collection::<SablensAnnotation>(COLL);
    let res = coll
        .delete_many(doc! { "userId": user_id, "sessionId": oid })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sablens_annotations.delete_many"))
        })?;
    Ok(Json(ClearResponse {
        deleted: res.deleted_count,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn valid_kinds() {
        for k in ["arrow", "circle", "rect", "freehand", "text"] {
            assert!(is_valid_kind(k));
        }
        assert!(!is_valid_kind("polygon"));
    }
}
