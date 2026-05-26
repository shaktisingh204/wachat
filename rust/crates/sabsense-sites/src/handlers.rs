//! HTTP handlers for PageSense sites.

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
use rand::{Rng, distributions::Alphanumeric};
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    CreateSiteInput, CreateSiteResponse, DeleteSiteResponse, ListQuery, SnippetKeyLookupResponse,
    UpdateSiteInput,
};
use crate::types::PagesenseSite;

const COLL: &str = "pagesense_sites";

fn random_snippet_key() -> String {
    rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(32)
        .map(char::from)
        .collect()
}

fn list_filter(user_id: ObjectId, status: Option<&str>) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
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

fn site_from_create(input: CreateSiteInput, user_id: ObjectId) -> PagesenseSite {
    PagesenseSite {
        id: None,
        user_id,
        name: input.name,
        domain: input.domain,
        snippet_key: random_snippet_key(),
        screenshot_url: input.screenshot_url,
        is_active: Some(input.is_active.unwrap_or(true)),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
        status: Some("active".to_owned()),
    }
}

fn build_update_doc(patch: UpdateSiteInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch.domain {
        set.insert("domain", v);
    }
    if let Some(v) = patch.screenshot_url {
        set.insert("screenshotUrl", v);
    }
    if let Some(v) = patch.is_active {
        set.insert("isActive", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    if patch.rotate_snippet_key.unwrap_or(false) {
        set.insert("snippetKey", random_snippet_key());
    }
    doc! { "$set": set }
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<PagesenseSite>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_sites(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "domain"]);
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

    let coll = mongo.collection::<PagesenseSite>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("pagesense_sites.find")))?;
    let mut rows: Vec<PagesenseSite> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("pagesense_sites.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, site_id = %site_id))]
pub async fn get_site(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(site_id): Path<String>,
) -> Result<Json<PagesenseSite>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&site_id)?;
    let coll = mongo.collection::<PagesenseSite>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("pagesense_sites.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("site".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_site(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateSiteInput>,
) -> Result<Json<CreateSiteResponse>> {
    let user_id = user_oid(&user)?;
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    if input.domain.trim().is_empty() {
        return Err(ApiError::Validation("domain is required".to_owned()));
    }

    let mut entity = site_from_create(input, user_id);
    let coll = mongo.collection::<PagesenseSite>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("pagesense_sites.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);

    Ok(Json(CreateSiteResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, site_id = %site_id))]
pub async fn update_site(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(site_id): Path<String>,
    Json(patch): Json<UpdateSiteInput>,
) -> Result<Json<PagesenseSite>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&site_id)?;
    let coll = mongo.collection::<PagesenseSite>(COLL);
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("pagesense_sites.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("site".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("pagesense_sites.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("site".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, site_id = %site_id))]
pub async fn delete_site(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(site_id): Path<String>,
) -> Result<Json<DeleteSiteResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&site_id)?;
    let coll = mongo.collection::<PagesenseSite>(COLL);
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
            ApiError::Internal(anyhow::Error::new(e).context("pagesense_sites.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("site".to_owned()));
    }
    Ok(Json(DeleteSiteResponse { deleted: true }))
}

/// Public lookup used by `/api/pagesense/ingest` to validate the
/// snippet key before forwarding events. Returns the site's
/// `userId` so the ingester can scope writes correctly.
///
/// TODO: this should be called from inside an internal-only network
/// boundary or guarded by a shared service token. For now it's an
/// unauthenticated lookup that the host `api` crate exposes only on
/// the internal Rust port.
#[instrument(skip_all, fields(snippet_key_len = snippet_key.len()))]
pub async fn lookup_by_snippet_key(
    State(mongo): State<MongoHandle>,
    Path(snippet_key): Path<String>,
) -> Result<Json<SnippetKeyLookupResponse>> {
    if snippet_key.trim().is_empty() {
        return Err(ApiError::Validation("snippetKey is required".to_owned()));
    }
    let coll = mongo.collection::<PagesenseSite>(COLL);
    let row = coll
        .find_one(doc! { "snippetKey": &snippet_key })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("pagesense_sites.lookup_key"))
        })?
        .ok_or_else(|| ApiError::NotFound("site".to_owned()))?;

    let site_id = row
        .id
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("site doc missing _id")))?;

    Ok(Json(SnippetKeyLookupResponse {
        site_id: site_id.to_hex(),
        user_id: row.user_id.to_hex(),
        domain: row.domain,
        is_active: row.is_active.unwrap_or(true)
            && row.status.as_deref().unwrap_or("active") != "archived",
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn random_snippet_key_is_32_alphanumeric() {
        let key = random_snippet_key();
        assert_eq!(key.len(), 32);
        assert!(key.chars().all(|c| c.is_ascii_alphanumeric()));
    }

    #[test]
    fn site_from_create_stamps_active_status_and_key() {
        let user_id = ObjectId::new();
        let s = site_from_create(
            CreateSiteInput {
                name: "Acme".into(),
                domain: "acme.example".into(),
                ..Default::default()
            },
            user_id,
        );
        assert_eq!(s.status.as_deref(), Some("active"));
        assert_eq!(s.snippet_key.len(), 32);
        assert_eq!(s.user_id, user_id);
    }
}
