//! HTTP handlers for SabConnect custom apps.

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
    CreateCustomAppInput, CreateCustomAppResponse, DeleteCustomAppResponse, ListQuery,
    UpdateCustomAppInput,
};
use crate::types::SabConnectCustomApp;

const COLL: &str = "sabconnect_custom_apps";

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn validate_url(url: &str) -> Result<()> {
    let u = url.trim();
    if u.is_empty() {
        return Err(ApiError::Validation("url is required".to_owned()));
    }
    if !(u.starts_with("http://") || u.starts_with("https://")) {
        return Err(ApiError::Validation(
            "url must start with http:// or https://".to_owned(),
        ));
    }
    Ok(())
}

fn app_from_create(input: CreateCustomAppInput, user_id: ObjectId) -> Result<SabConnectCustomApp> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    validate_url(&input.url)?;
    let open_in = input.open_in.unwrap_or_else(|| "new_tab".to_owned());
    if !matches!(open_in.as_str(), "iframe" | "new_tab") {
        return Err(ApiError::Validation(
            "openIn must be iframe|new_tab".to_owned(),
        ));
    }
    let now = BsonDateTime::from_chrono(Utc::now());
    Ok(SabConnectCustomApp {
        id: None,
        user_id,
        name: input.name.trim().to_owned(),
        description: input.description,
        icon_file_id: input.icon_file_id,
        url: input.url.trim().to_owned(),
        open_in,
        sort_order: input.sort_order.unwrap_or(0),
        status: "active".to_owned(),
        created_at: now,
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateCustomAppInput) -> Result<Document> {
    let now = BsonDateTime::from_chrono(Utc::now());
    let mut set = doc! { "updatedAt": now };
    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch.url {
        validate_url(&v)?;
        set.insert("url", v);
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.icon_file_id {
        set.insert("iconFileId", v);
    }
    if let Some(v) = patch.open_in {
        if !matches!(v.as_str(), "iframe" | "new_tab") {
            return Err(ApiError::Validation(
                "openIn must be iframe|new_tab".to_owned(),
            ));
        }
        set.insert("openIn", v);
    }
    if let Some(v) = patch.sort_order {
        set.insert("sortOrder", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    Ok(doc! { "$set": set })
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabConnectCustomApp>,
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
    let mut filter = doc! { "userId": user_id };
    match q.status.as_deref().unwrap_or("active") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "description", "url"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "sortOrder": 1, "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<SabConnectCustomApp>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabconnect_custom_apps.find"))
        })?;
    let mut rows: Vec<SabConnectCustomApp> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabconnect_custom_apps.collect"))
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
) -> Result<Json<SabConnectCustomApp>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&app_id)?;
    let coll = mongo.collection::<SabConnectCustomApp>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabconnect_custom_apps.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("custom app".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_app(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateCustomAppInput>,
) -> Result<Json<CreateCustomAppResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = app_from_create(input, user_id)?;
    let coll = mongo.collection::<SabConnectCustomApp>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabconnect_custom_apps.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(CreateCustomAppResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %app_id))]
pub async fn update_app(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(app_id): Path<String>,
    Json(patch): Json<UpdateCustomAppInput>,
) -> Result<Json<SabConnectCustomApp>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&app_id)?;
    let coll = mongo.collection::<SabConnectCustomApp>(COLL);
    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabconnect_custom_apps.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("custom app".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabconnect_custom_apps.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("custom app".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %app_id))]
pub async fn delete_app(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(app_id): Path<String>,
) -> Result<Json<DeleteCustomAppResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&app_id)?;
    let coll = mongo.collection::<SabConnectCustomApp>(COLL);
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
            ApiError::Internal(anyhow::Error::new(e).context("sabconnect_custom_apps.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("custom app".to_owned()));
    }
    Ok(Json(DeleteCustomAppResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_url_rejects_non_http() {
        assert!(validate_url("javascript:alert(1)").is_err());
        assert!(validate_url("").is_err());
        assert!(validate_url("https://example.com").is_ok());
    }
}
