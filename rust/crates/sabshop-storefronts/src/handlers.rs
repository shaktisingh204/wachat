//! HTTP handlers for SabShop storefronts.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_common::{
    audit::{audit_for_create, audit_for_delete, audit_for_update, write_audit},
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
    CreateStorefrontInput, CreateStorefrontResponse, DeleteStorefrontResponse, ListQuery,
    UpdateStorefrontInput,
};
use crate::types::SabshopStorefront;

const COLL: &str = "sabshop_storefronts";
const ENTITY_KIND: &str = "sabshop_storefront";

fn list_filter(user_id: ObjectId, status: Option<&str>) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("all") {
        "live" => {
            filter.insert("status", "live");
        }
        "draft" => {
            filter.insert("status", "draft");
        }
        "paused" => {
            filter.insert("status", "paused");
        }
        _ => {}
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn entity_from_create(
    input: CreateStorefrontInput,
    user_id: ObjectId,
) -> Result<SabshopStorefront> {
    if input.slug.trim().is_empty() {
        return Err(ApiError::Validation("slug is required".to_owned()));
    }
    if input.display_name.trim().is_empty() {
        return Err(ApiError::Validation("displayName is required".to_owned()));
    }
    Ok(SabshopStorefront {
        id: None,
        user_id,
        tenant_id: None,
        slug: input.slug.trim().to_lowercase(),
        display_name: input.display_name.trim().to_owned(),
        description: input.description,
        theme_id: input
            .theme_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        currency: input.currency.unwrap_or_else(|| "INR".to_owned()),
        shipping_zone_ids: Vec::new(),
        tax_rule_ids: Vec::new(),
        status: "draft".to_owned(),
        custom_css: None,
        logo_url: None,
        favicon_url: None,
        hero_image_url: None,
        hero_title: None,
        hero_subtitle: None,
        featured_product_ids: Vec::new(),
        featured_collection_ids: Vec::new(),
        published_product_ids: Vec::new(),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn ids_to_bson(ids: Vec<String>) -> Vec<Bson> {
    ids.into_iter()
        .filter_map(|s| ObjectId::parse_str(&s).ok().map(Bson::ObjectId))
        .collect()
}

fn build_update_doc(patch: UpdateStorefrontInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.slug {
        set.insert("slug", v.trim().to_lowercase());
    }
    if let Some(v) = patch.display_name {
        set.insert("displayName", v);
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.currency {
        set.insert("currency", v);
    }
    if let Some(v) = patch
        .theme_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("themeId", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    if let Some(v) = patch.custom_css {
        set.insert("customCss", v);
    }
    if let Some(v) = patch.logo_url {
        set.insert("logoUrl", v);
    }
    if let Some(v) = patch.favicon_url {
        set.insert("faviconUrl", v);
    }
    if let Some(v) = patch.hero_image_url {
        set.insert("heroImageUrl", v);
    }
    if let Some(v) = patch.hero_title {
        set.insert("heroTitle", v);
    }
    if let Some(v) = patch.hero_subtitle {
        set.insert("heroSubtitle", v);
    }
    if let Some(v) = patch.shipping_zone_ids {
        set.insert("shippingZoneIds", ids_to_bson(v));
    }
    if let Some(v) = patch.tax_rule_ids {
        set.insert("taxRuleIds", ids_to_bson(v));
    }
    if let Some(v) = patch.featured_product_ids {
        set.insert("featuredProductIds", ids_to_bson(v));
    }
    if let Some(v) = patch.featured_collection_ids {
        set.insert("featuredCollectionIds", ids_to_bson(v));
    }
    if let Some(v) = patch.published_product_ids {
        set.insert("publishedProductIds", ids_to_bson(v));
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &SabshopStorefront) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabshopStorefront>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_storefronts(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["slug", "displayName", "description"]);
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

    let coll = mongo.collection::<SabshopStorefront>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabshop_storefronts.find"))
    })?;
    let mut rows: Vec<SabshopStorefront> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabshop_storefronts.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, storefront_id = %storefront_id))]
pub async fn get_storefront(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(storefront_id): Path<String>,
) -> Result<Json<SabshopStorefront>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&storefront_id)?;
    let coll = mongo.collection::<SabshopStorefront>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabshop_storefronts.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("storefront".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_storefront(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateStorefrontInput>,
) -> Result<Json<CreateStorefrontResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = entity_from_create(input, user_id)?;
    let coll = mongo.collection::<SabshopStorefront>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabshop_storefronts.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateStorefrontResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, storefront_id = %storefront_id))]
pub async fn update_storefront(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(storefront_id): Path<String>,
    Json(patch): Json<UpdateStorefrontInput>,
) -> Result<Json<SabshopStorefront>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&storefront_id)?;
    let coll = mongo.collection::<SabshopStorefront>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabshop_storefronts.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("storefront".to_owned()))?;
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabshop_storefronts.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("storefront".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabshop_storefronts.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("storefront".to_owned()))?;
    if let Some(event) = audit_for_update(
        &user,
        ENTITY_KIND,
        oid,
        Some(doc_for_audit(&before)),
        Some(doc_for_audit(&after)),
    ) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, storefront_id = %storefront_id))]
pub async fn delete_storefront(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(storefront_id): Path<String>,
) -> Result<Json<DeleteStorefrontResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&storefront_id)?;
    let coll = mongo.collection::<SabshopStorefront>(COLL);
    let result = coll
        .delete_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabshop_storefronts.delete"))
        })?;
    if result.deleted_count == 0 {
        return Err(ApiError::NotFound("storefront".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteStorefrontResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_status_live() {
        let oid = ObjectId::new();
        let f = list_filter(oid, Some("live"));
        assert_eq!(f.get_str("status").ok(), Some("live"));
    }

    #[test]
    fn entity_from_create_lowercases_slug_and_drafts() {
        let user_id = ObjectId::new();
        let input = CreateStorefrontInput {
            slug: "MyShop".into(),
            display_name: "My Shop".into(),
            ..Default::default()
        };
        let e = entity_from_create(input, user_id).unwrap();
        assert_eq!(e.slug, "myshop");
        assert_eq!(e.status, "draft");
        assert_eq!(e.currency, "INR");
    }

    #[test]
    fn entity_from_create_rejects_empty_display_name() {
        let user_id = ObjectId::new();
        let input = CreateStorefrontInput {
            slug: "x".into(),
            display_name: " ".into(),
            ..Default::default()
        };
        assert!(entity_from_create(input, user_id).is_err());
    }
}
