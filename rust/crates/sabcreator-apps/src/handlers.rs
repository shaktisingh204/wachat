//! HTTP handlers for the App entity.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId, to_bson};
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
    CreateAppInput, CreateAppResponse, DeleteAppResponse, ListQuery, UpdateAppInput,
};
use crate::types::SabcreatorApp;

const COLL: &str = "sabcreator_apps";

fn slugify(name: &str) -> String {
    let mut out = String::with_capacity(name.len());
    let mut prev_dash = false;
    for c in name.chars() {
        if c.is_ascii_alphanumeric() {
            out.push(c.to_ascii_lowercase());
            prev_dash = false;
        } else if !prev_dash && !out.is_empty() {
            out.push('-');
            prev_dash = true;
        }
    }
    while out.ends_with('-') {
        out.pop();
    }
    if out.is_empty() {
        out.push_str("app");
    }
    out
}

fn list_filter(user_id: ObjectId, status: Option<&str>) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "draft" => {
            filter.insert("status", "draft");
        }
        "published" => {
            filter.insert("status", "published");
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
    pub items: Vec<SabcreatorApp>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_apps(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "description", "slug"]);
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
    let coll = mongo.collection::<SabcreatorApp>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcreator_apps.find"))
        })?;
    let mut rows: Vec<SabcreatorApp> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcreator_apps.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %app_id))]
pub async fn get_app(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(app_id): Path<String>,
) -> Result<Json<SabcreatorApp>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&app_id)?;
    let coll = mongo.collection::<SabcreatorApp>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcreator_apps.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("app".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_app(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateAppInput>,
) -> Result<Json<CreateAppResponse>> {
    let user_id = user_oid(&user)?;
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    let slug = input
        .slug
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(slugify)
        .unwrap_or_else(|| slugify(&input.name));
    let sabtables_base_oid = match input.sabtables_base_id.as_deref().filter(|s| !s.is_empty()) {
        Some(s) => Some(oid_from_str(s)?),
        None => None,
    };
    let now = BsonDateTime::from_chrono(Utc::now());
    let mut entity = SabcreatorApp {
        id: None,
        user_id,
        name: input.name.trim().to_owned(),
        slug,
        description: input.description,
        icon_file_id: input.icon_file_id,
        sabtables_base_id: sabtables_base_oid,
        status: "draft".to_owned(),
        theme_json: input.theme_json,
        created_at: now,
        updated_at: None,
    };
    let coll = mongo.collection::<SabcreatorApp>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcreator_apps.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(CreateAppResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %app_id))]
pub async fn update_app(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(app_id): Path<String>,
    Json(patch): Json<UpdateAppInput>,
) -> Result<Json<SabcreatorApp>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&app_id)?;
    let coll = mongo.collection::<SabcreatorApp>(COLL);
    let now = BsonDateTime::from_chrono(Utc::now());
    let mut set = doc! { "updatedAt": now };
    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch.slug {
        set.insert("slug", slugify(&v));
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.icon_file_id {
        set.insert("iconFileId", v);
    }
    if let Some(v) = patch.sabtables_base_id.filter(|s| !s.is_empty()) {
        set.insert("sabtablesBaseId", oid_from_str(&v)?);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    if let Some(v) = patch.theme_json {
        let b = to_bson(&v).map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("themeJson serialization"))
        })?;
        set.insert("themeJson", b);
    }
    let result = coll
        .update_one(ownership_filter(user_id, oid), doc! { "$set": set })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcreator_apps.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("app".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcreator_apps.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("app".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %app_id))]
pub async fn delete_app(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(app_id): Path<String>,
) -> Result<Json<DeleteAppResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&app_id)?;
    let coll = mongo.collection::<SabcreatorApp>(COLL);
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
            ApiError::Internal(anyhow::Error::new(e).context("sabcreator_apps.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("app".to_owned()));
    }
    Ok(Json(DeleteAppResponse { deleted: true }))
}
