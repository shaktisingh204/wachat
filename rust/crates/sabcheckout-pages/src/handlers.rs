//! HTTP handlers for SabCheckout Pages.

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
    CreatePageInput, CreatePageResponse, DeletePageResponse, ListQuery, PublicPageView,
    UpdatePageInput,
};
use crate::types::SabcheckoutPage;

const COLL: &str = "sabcheckout_pages";

fn list_filter(user_id: ObjectId, status: Option<&str>) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status {
        Some("all") | None => {}
        Some(s) => {
            filter.insert("status", s);
        }
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn theme_doc(v: Option<&serde_json::Value>) -> Option<bson::Document> {
    v.and_then(|val| bson::to_document(val).ok())
}

fn page_from_create(input: CreatePageInput, user_id: ObjectId) -> Result<SabcheckoutPage> {
    if input.slug.trim().is_empty() {
        return Err(ApiError::Validation("slug is required".to_owned()));
    }
    if input.display_name.trim().is_empty() {
        return Err(ApiError::Validation("displayName is required".to_owned()));
    }
    Ok(SabcheckoutPage {
        id: None,
        user_id,
        slug: input.slug.trim().to_lowercase(),
        display_name: input.display_name.trim().to_owned(),
        headline: input.headline,
        description: input.description,
        theme_json: theme_doc(input.theme_json.as_ref()),
        logo_file_id: input.logo_file_id,
        currency: input.currency.unwrap_or_else(|| "INR".to_owned()),
        status: input.status.unwrap_or_else(|| "draft".to_owned()),
        mode: input.mode.unwrap_or_else(|| "one_off".to_owned()),
        items: input.items,
        require_fields: input.require_fields,
        success_url: input.success_url,
        cancel_url: input.cancel_url,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdatePageInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.slug {
        set.insert("slug", v.trim().to_lowercase());
    }
    if let Some(v) = patch.display_name {
        set.insert("displayName", v);
    }
    if let Some(v) = patch.headline {
        set.insert("headline", v);
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = theme_doc(patch.theme_json.as_ref()) {
        set.insert("themeJson", v);
    }
    if let Some(v) = patch.logo_file_id {
        set.insert("logoFileId", v);
    }
    if let Some(v) = patch.currency {
        set.insert("currency", v);
    }
    if let Some(v) = patch.mode {
        set.insert("mode", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    if let Some(v) = patch.items {
        if let Ok(arr) = bson::to_bson(&v) {
            set.insert("items", arr);
        }
    }
    if let Some(v) = patch.require_fields {
        if let Ok(arr) = bson::to_bson(&v) {
            set.insert("requireFields", arr);
        }
    }
    if let Some(v) = patch.success_url {
        set.insert("successUrl", v);
    }
    if let Some(v) = patch.cancel_url {
        set.insert("cancelUrl", v);
    }
    doc! { "$set": set }
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabcheckoutPage>,
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
    let mut filter = list_filter(user_id, q.status.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["slug", "displayName", "headline"]);
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

    let coll = mongo.collection::<SabcheckoutPage>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcheckout_pages.find")))?;
    let mut rows: Vec<SabcheckoutPage> = cursor
        .try_collect()
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcheckout_pages.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, page_id = %page_id))]
pub async fn get_page(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(page_id): Path<String>,
) -> Result<Json<SabcheckoutPage>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&page_id)?;
    let coll = mongo.collection::<SabcheckoutPage>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcheckout_pages.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabcheckout_page".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_page(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreatePageInput>,
) -> Result<Json<CreatePageResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = page_from_create(input, user_id)?;
    let coll = mongo.collection::<SabcheckoutPage>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcheckout_pages.insert"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, page_id = %page_id))]
pub async fn update_page(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(page_id): Path<String>,
    Json(patch): Json<UpdatePageInput>,
) -> Result<Json<SabcheckoutPage>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&page_id)?;
    let coll = mongo.collection::<SabcheckoutPage>(COLL);
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcheckout_pages.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("sabcheckout_page".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcheckout_pages.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabcheckout_page".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, page_id = %page_id))]
pub async fn delete_page(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(page_id): Path<String>,
) -> Result<Json<DeletePageResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&page_id)?;
    let coll = mongo.collection::<SabcheckoutPage>(COLL);
    let result = coll
        .delete_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcheckout_pages.delete"))
        })?;
    Ok(Json(DeletePageResponse {
        deleted: result.deleted_count > 0,
    }))
}

/// Public (unauthenticated) page lookup by slug. Only returns pages
/// whose status is `live`.
#[instrument(skip_all, fields(slug = %slug))]
pub async fn public_get_by_slug(
    State(mongo): State<MongoHandle>,
    Path(slug): Path<String>,
) -> Result<Json<PublicPageView>> {
    let slug_norm = slug.trim().to_lowercase();
    if slug_norm.is_empty() {
        return Err(ApiError::Validation("slug is required".to_owned()));
    }
    let coll = mongo.collection::<SabcheckoutPage>(COLL);
    let row = coll
        .find_one(doc! { "slug": &slug_norm, "status": "live" })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcheckout_pages.public_find"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabcheckout_page".to_owned()))?;

    let id = row
        .id
        .map(|o| o.to_hex())
        .unwrap_or_default();
    let user_id = row.user_id.to_hex();
    Ok(Json(PublicPageView {
        id,
        user_id,
        page: row,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_requires_slug() {
        let user_id = ObjectId::new();
        let input = CreatePageInput {
            slug: "   ".into(),
            display_name: "Storefront".into(),
            ..Default::default()
        };
        assert!(page_from_create(input, user_id).is_err());
    }

    #[test]
    fn create_normalizes_slug() {
        let user_id = ObjectId::new();
        let input = CreatePageInput {
            slug: " Foo-BAR ".into(),
            display_name: "Foo".into(),
            ..Default::default()
        };
        let p = page_from_create(input, user_id).unwrap();
        assert_eq!(p.slug, "foo-bar");
        assert_eq!(p.status, "draft");
        assert_eq!(p.mode, "one_off");
        assert_eq!(p.currency, "INR");
    }
}
