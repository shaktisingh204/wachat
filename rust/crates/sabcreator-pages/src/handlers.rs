//! HTTP handlers for the Page entity.

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
use serde_json::Value;
use tracing::instrument;

use crate::dto::{
    CreatePageInput, CreatePageResponse, DeletePageResponse, ListQuery, UpdatePageInput,
};
use crate::types::SabcreatorPage;

const COLL: &str = "sabcreator_pages";

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
        out.push_str("page");
    }
    out
}

fn list_filter(
    user_id: ObjectId,
    app_id: Option<ObjectId>,
    kind: Option<&str>,
    status: Option<&str>,
) -> Document {
    let mut filter = doc! { "userId": user_id };
    if let Some(a) = app_id {
        filter.insert("appId", a);
    }
    if let Some(k) = kind {
        filter.insert("kind", k);
    }
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

fn role_ids_to_oids(ids: &[String]) -> Result<Vec<ObjectId>> {
    ids.iter()
        .filter(|s| !s.is_empty())
        .map(|s| oid_from_str(s))
        .collect()
}

fn json_to_bson(v: &Value, ctx: &'static str) -> Result<Bson> {
    to_bson(v).map_err(|e| ApiError::Internal(anyhow::Error::new(e).context(ctx)))
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabcreatorPage>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_pages(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let app_oid = match q.app_id.as_deref().filter(|s| !s.is_empty()) {
        Some(s) => Some(oid_from_str(s)?),
        None => None,
    };
    let mut filter = list_filter(user_id, app_oid, q.kind.as_deref(), q.status.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "slug"]);
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
    let coll = mongo.collection::<SabcreatorPage>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcreator_pages.find"))
        })?;
    let mut rows: Vec<SabcreatorPage> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcreator_pages.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %page_id))]
pub async fn get_page(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(page_id): Path<String>,
) -> Result<Json<SabcreatorPage>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&page_id)?;
    let coll = mongo.collection::<SabcreatorPage>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcreator_pages.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("page".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_page(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreatePageInput>,
) -> Result<Json<CreatePageResponse>> {
    let user_id = user_oid(&user)?;
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    if input.kind.trim().is_empty() {
        return Err(ApiError::Validation("kind is required".to_owned()));
    }
    let app_oid = oid_from_str(&input.app_id)?;
    let slug = input
        .slug
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(slugify)
        .unwrap_or_else(|| slugify(&input.name));
    let allowed = match input.allowed_role_ids {
        Some(v) => role_ids_to_oids(&v)?,
        None => Vec::new(),
    };
    let now = BsonDateTime::from_chrono(Utc::now());
    let mut entity = SabcreatorPage {
        id: None,
        user_id,
        app_id: app_oid,
        name: input.name.trim().to_owned(),
        slug,
        kind: input.kind.trim().to_owned(),
        config_json: input.config_json.unwrap_or_else(|| Value::Object(Default::default())),
        role_visibility: input.role_visibility.unwrap_or_else(|| "all".to_owned()),
        allowed_role_ids: allowed,
        status: "draft".to_owned(),
        created_at: now,
        updated_at: None,
    };
    let coll = mongo.collection::<SabcreatorPage>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcreator_pages.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(CreatePageResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %page_id))]
pub async fn update_page(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(page_id): Path<String>,
    Json(patch): Json<UpdatePageInput>,
) -> Result<Json<SabcreatorPage>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&page_id)?;
    let coll = mongo.collection::<SabcreatorPage>(COLL);
    let now = BsonDateTime::from_chrono(Utc::now());
    let mut set = doc! { "updatedAt": now };
    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch.slug {
        set.insert("slug", slugify(&v));
    }
    if let Some(v) = patch.kind {
        set.insert("kind", v);
    }
    if let Some(v) = patch.config_json {
        set.insert("configJson", json_to_bson(&v, "configJson")?);
    }
    if let Some(v) = patch.role_visibility {
        set.insert("roleVisibility", v);
    }
    if let Some(v) = patch.allowed_role_ids {
        let oids = role_ids_to_oids(&v)?;
        let arr: Vec<Bson> = oids.into_iter().map(Bson::ObjectId).collect();
        set.insert("allowedRoleIds", arr);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    let result = coll
        .update_one(ownership_filter(user_id, oid), doc! { "$set": set })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcreator_pages.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("page".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcreator_pages.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("page".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %page_id))]
pub async fn delete_page(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(page_id): Path<String>,
) -> Result<Json<DeletePageResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&page_id)?;
    let coll = mongo.collection::<SabcreatorPage>(COLL);
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
            ApiError::Internal(anyhow::Error::new(e).context("sabcreator_pages.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("page".to_owned()));
    }
    Ok(Json(DeletePageResponse { deleted: true }))
}
