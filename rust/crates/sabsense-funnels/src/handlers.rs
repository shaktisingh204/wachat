//! Funnel definition handlers.

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
    CreateFunnelInput, CreateFunnelResponse, DeleteFunnelResponse, ListQuery, UpdateFunnelInput,
};
use crate::types::Funnel;

const COLL: &str = "pagesense_funnels";

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<Funnel>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id, site_id = %q.site_id))]
pub async fn list_funnels(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let site_id = oid_from_str(&q.site_id)?;
    let mut filter: Document = doc! {
        "userId": user_id,
        "siteId": site_id,
        "status": { "$ne": "archived" },
    };
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name"]);
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

    let coll = mongo.collection::<Funnel>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("pagesense_funnels.find")))?;
    let mut rows: Vec<Funnel> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("pagesense_funnels.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, funnel_id = %funnel_id))]
pub async fn get_funnel(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(funnel_id): Path<String>,
) -> Result<Json<Funnel>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&funnel_id)?;
    let coll = mongo.collection::<Funnel>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("pagesense_funnels.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("funnel".into()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id, site_id = %input.site_id))]
pub async fn create_funnel(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateFunnelInput>,
) -> Result<Json<CreateFunnelResponse>> {
    let user_id = user_oid(&user)?;
    let site_id = oid_from_str(&input.site_id)?;
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".into()));
    }
    if input.steps.is_empty() {
        return Err(ApiError::Validation("at least one step is required".into()));
    }
    let mut entity = Funnel {
        id: None,
        user_id,
        site_id,
        name: input.name,
        steps: input.steps,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
        status: Some("active".into()),
    };
    let coll = mongo.collection::<Funnel>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("pagesense_funnels.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(CreateFunnelResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, funnel_id = %funnel_id))]
pub async fn update_funnel(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(funnel_id): Path<String>,
    Json(patch): Json<UpdateFunnelInput>,
) -> Result<Json<Funnel>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&funnel_id)?;
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch.steps {
        set.insert(
            "steps",
            bson::to_bson(&v).map_err(|e| {
                ApiError::Internal(anyhow::Error::new(e).context("pagesense_funnels.steps_bson"))
            })?,
        );
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    let coll = mongo.collection::<Funnel>(COLL);
    let result = coll
        .update_one(ownership_filter(user_id, oid), doc! { "$set": set })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("pagesense_funnels.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("funnel".into()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("pagesense_funnels.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("funnel".into()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, funnel_id = %funnel_id))]
pub async fn delete_funnel(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(funnel_id): Path<String>,
) -> Result<Json<DeleteFunnelResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&funnel_id)?;
    let coll = mongo.collection::<Funnel>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": { "status": "archived", "updatedAt": BsonDateTime::from_chrono(Utc::now()) } },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("pagesense_funnels.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("funnel".into()));
    }
    Ok(Json(DeleteFunnelResponse { deleted: true }))
}
