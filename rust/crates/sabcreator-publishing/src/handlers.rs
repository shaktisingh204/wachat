//! HTTP handlers for the Publication entity.

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

use crate::dto::{ListQuery, PublishInput, PublishResponse};
use crate::types::SabcreatorPublication;

const COLL: &str = "sabcreator_publications";

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabcreatorPublication>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_publications(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = doc! { "userId": user_id };
    if let Some(s) = q.app_id.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("appId", oid_from_str(s)?);
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "publishedAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<SabcreatorPublication>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcreator_publications.find"))
    })?;
    let mut rows: Vec<SabcreatorPublication> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcreator_publications.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %publication_id))]
pub async fn get_publication(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(publication_id): Path<String>,
) -> Result<Json<SabcreatorPublication>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&publication_id)?;
    let coll = mongo.collection::<SabcreatorPublication>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcreator_publications.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("publication".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id, app_id = %app_id))]
pub async fn get_latest_for_app(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(app_id): Path<String>,
) -> Result<Json<SabcreatorPublication>> {
    let user_id = user_oid(&user)?;
    let app_oid = oid_from_str(&app_id)?;
    let coll = mongo.collection::<SabcreatorPublication>(COLL);
    let opts = mongodb::options::FindOneOptions::builder()
        .sort(doc! { "version": -1 })
        .build();
    let row = coll
        .find_one(doc! { "userId": user_id, "appId": app_oid })
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcreator_publications.latest"))
        })?
        .ok_or_else(|| ApiError::NotFound("publication".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn publish(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<PublishInput>,
) -> Result<Json<PublishResponse>> {
    let user_id = user_oid(&user)?;
    let app_oid = oid_from_str(&input.app_id)?;
    let coll = mongo.collection::<SabcreatorPublication>(COLL);

    // Compute next version.
    let opts = mongodb::options::FindOneOptions::builder()
        .sort(doc! { "version": -1 })
        .build();
    let next_version: u32 = match coll
        .find_one(doc! { "userId": user_id, "appId": app_oid })
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcreator_publications.nextVersion"))
        })? {
        Some(prev) => prev.version + 1,
        None => 1,
    };

    let now = BsonDateTime::from_chrono(Utc::now());
    let mut entity = SabcreatorPublication {
        id: None,
        user_id,
        app_id: app_oid,
        version: next_version,
        published_at: now,
        published_by: user_id,
        snapshot_json: input.snapshot_json,
    };
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcreator_publications.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(PublishResponse {
        id: new_id.to_hex(),
        version: next_version,
        entity,
    }))
}
