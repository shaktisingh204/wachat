//! HTTP handlers for the Base entity.

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
    CreateBaseInput, CreateBaseResponse, DeleteBaseResponse, ListQuery, UpdateBaseInput,
};
use crate::types::SabtablesBase;

const COLL: &str = "sabtables_bases";

fn list_filter(
    user_id: ObjectId,
    workspace_id: Option<ObjectId>,
    status: Option<&str>,
) -> Document {
    let mut filter = doc! { "userId": user_id };
    if let Some(w) = workspace_id {
        filter.insert("workspaceId", w);
    }
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
    doc! { "_id": oid, "userId": user_id }
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabtablesBase>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_bases(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let workspace_oid = match q.workspace_id.as_deref().filter(|s| !s.is_empty()) {
        Some(s) => Some(oid_from_str(s)?),
        None => None,
    };
    let mut filter = list_filter(user_id, workspace_oid, q.status.as_deref());
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
    let coll = mongo.collection::<SabtablesBase>(COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabtables_bases.find"))
        })?;
    let mut rows: Vec<SabtablesBase> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabtables_bases.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %base_id))]
pub async fn get_base(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(base_id): Path<String>,
) -> Result<Json<SabtablesBase>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&base_id)?;
    let coll = mongo.collection::<SabtablesBase>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabtables_bases.find_one")))?
        .ok_or_else(|| ApiError::NotFound("base".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_base(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateBaseInput>,
) -> Result<Json<CreateBaseResponse>> {
    let user_id = user_oid(&user)?;
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    let workspace_oid = oid_from_str(&input.workspace_id)?;
    let now = BsonDateTime::from_chrono(Utc::now());
    let mut entity = SabtablesBase {
        id: None,
        user_id,
        workspace_id: workspace_oid,
        name: input.name.trim().to_owned(),
        description: input.description,
        color: input.color,
        icon: input.icon,
        status: "active".to_owned(),
        created_at: now,
        updated_at: None,
    };
    let coll = mongo.collection::<SabtablesBase>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabtables_bases.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(CreateBaseResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %base_id))]
pub async fn update_base(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(base_id): Path<String>,
    Json(patch): Json<UpdateBaseInput>,
) -> Result<Json<SabtablesBase>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&base_id)?;
    let coll = mongo.collection::<SabtablesBase>(COLL);
    let now = BsonDateTime::from_chrono(Utc::now());
    let mut set = doc! { "updatedAt": now };
    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.color {
        set.insert("color", v);
    }
    if let Some(v) = patch.icon {
        set.insert("icon", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    let result = coll
        .update_one(ownership_filter(user_id, oid), doc! { "$set": set })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabtables_bases.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("base".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabtables_bases.refetch")))?
        .ok_or_else(|| ApiError::NotFound("base".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %base_id))]
pub async fn delete_base(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(base_id): Path<String>,
) -> Result<Json<DeleteBaseResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&base_id)?;
    let coll = mongo.collection::<SabtablesBase>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabtables_bases.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("base".to_owned()));
    }
    Ok(Json(DeleteBaseResponse { deleted: true }))
}
