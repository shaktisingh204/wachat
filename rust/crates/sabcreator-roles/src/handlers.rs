//! HTTP handlers for the Role entity.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, DateTime as BsonDateTime, Document, doc, oid::ObjectId, to_bson};
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
    CreateRoleInput, CreateRoleResponse, DeleteRoleResponse, ListQuery, UpdateRoleInput,
};
use crate::types::{RowLevelRule, SabcreatorRole};

const COLL: &str = "sabcreator_roles";

fn ids_to_oids(ids: &[String]) -> Result<Vec<ObjectId>> {
    ids.iter()
        .filter(|s| !s.is_empty())
        .map(|s| oid_from_str(s))
        .collect()
}

fn rule_bson(r: &RowLevelRule, ctx: &'static str) -> Result<Bson> {
    to_bson(r).map_err(|e| ApiError::Internal(anyhow::Error::new(e).context(ctx)))
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabcreatorRole>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_roles(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = doc! { "userId": user_id };
    if let Some(s) = q.app_id.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("appId", oid_from_str(s)?);
    }
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
    let coll = mongo.collection::<SabcreatorRole>(COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcreator_roles.find"))
        })?;
    let mut rows: Vec<SabcreatorRole> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcreator_roles.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %role_id))]
pub async fn get_role(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(role_id): Path<String>,
) -> Result<Json<SabcreatorRole>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&role_id)?;
    let coll = mongo.collection::<SabcreatorRole>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcreator_roles.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("role".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_role(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateRoleInput>,
) -> Result<Json<CreateRoleResponse>> {
    let user_id = user_oid(&user)?;
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    let app_oid = oid_from_str(&input.app_id)?;
    let forms = match input.forms_can_submit {
        Some(v) => ids_to_oids(&v)?,
        None => Vec::new(),
    };
    let pages = match input.pages_can_view {
        Some(v) => ids_to_oids(&v)?,
        None => Vec::new(),
    };
    let now = BsonDateTime::from_chrono(Utc::now());
    let mut entity = SabcreatorRole {
        id: None,
        user_id,
        app_id: app_oid,
        name: input.name.trim().to_owned(),
        color: input.color,
        records_can_read: input.records_can_read.unwrap_or_default(),
        records_can_edit: input.records_can_edit.unwrap_or_default(),
        records_can_delete: input.records_can_delete.unwrap_or_default(),
        forms_can_submit: forms,
        pages_can_view: pages,
        created_at: now,
        updated_at: None,
    };
    let coll = mongo.collection::<SabcreatorRole>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcreator_roles.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(CreateRoleResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %role_id))]
pub async fn update_role(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(role_id): Path<String>,
    Json(patch): Json<UpdateRoleInput>,
) -> Result<Json<SabcreatorRole>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&role_id)?;
    let coll = mongo.collection::<SabcreatorRole>(COLL);
    let now = BsonDateTime::from_chrono(Utc::now());
    let mut set = doc! { "updatedAt": now };
    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch.color {
        set.insert("color", v);
    }
    if let Some(v) = patch.records_can_read {
        set.insert("recordsCanRead", rule_bson(&v, "recordsCanRead")?);
    }
    if let Some(v) = patch.records_can_edit {
        set.insert("recordsCanEdit", rule_bson(&v, "recordsCanEdit")?);
    }
    if let Some(v) = patch.records_can_delete {
        set.insert("recordsCanDelete", rule_bson(&v, "recordsCanDelete")?);
    }
    if let Some(v) = patch.forms_can_submit {
        let arr: Vec<Bson> = ids_to_oids(&v)?.into_iter().map(Bson::ObjectId).collect();
        set.insert("formsCanSubmit", arr);
    }
    if let Some(v) = patch.pages_can_view {
        let arr: Vec<Bson> = ids_to_oids(&v)?.into_iter().map(Bson::ObjectId).collect();
        set.insert("pagesCanView", arr);
    }
    let result = coll
        .update_one(ownership_filter(user_id, oid), doc! { "$set": set })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcreator_roles.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("role".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcreator_roles.refetch")))?
        .ok_or_else(|| ApiError::NotFound("role".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %role_id))]
pub async fn delete_role(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(role_id): Path<String>,
) -> Result<Json<DeleteRoleResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&role_id)?;
    let coll = mongo.collection::<SabcreatorRole>(COLL);
    let result = coll
        .delete_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcreator_roles.delete"))
        })?;
    if result.deleted_count == 0 {
        return Err(ApiError::NotFound("role".to_owned()));
    }
    Ok(Json(DeleteRoleResponse { deleted: true }))
}
