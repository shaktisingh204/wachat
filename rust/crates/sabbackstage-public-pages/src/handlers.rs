//! HTTP handlers for sabbackstage-public-pages.

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
    CreatePublicPageInput, CreatePublicPageResponse, DeletePublicPageResponse, ListQuery,
    ListResponse, PublicPageView, UpdatePublicPageInput,
};
use crate::types::SabbackstagePublicPage;

const COLL: &str = "sabbackstage_public_pages";

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn theme_doc(v: Option<&serde_json::Value>) -> Option<bson::Document> {
    v.and_then(|val| bson::to_document(val).ok())
}

fn entity_from_create(
    input: CreatePublicPageInput,
    user_id: ObjectId,
) -> Result<SabbackstagePublicPage> {
    if input.slug.trim().is_empty() {
        return Err(ApiError::Validation("slug is required".to_owned()));
    }
    if input.headline.trim().is_empty() {
        return Err(ApiError::Validation("headline is required".to_owned()));
    }
    let event_id = ObjectId::parse_str(input.event_id.trim())
        .map_err(|_| ApiError::Validation("eventId must be a valid ObjectId".to_owned()))?;
    Ok(SabbackstagePublicPage {
        id: None,
        user_id,
        event_id,
        slug: input.slug.trim().to_lowercase(),
        headline: input.headline.trim().to_owned(),
        description: input.description,
        theme_json: theme_doc(input.theme_json.as_ref()),
        hero_image_file_id: input.hero_image_file_id,
        status: input.status.unwrap_or_else(|| "draft".to_owned()),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdatePublicPageInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.slug {
        set.insert("slug", v.trim().to_lowercase());
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
    if let Some(v) = patch.hero_image_file_id {
        set.insert("heroImageFileId", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    doc! { "$set": set }
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_public_pages(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = doc! { "userId": user_id };
    if let Some(v) = q
        .event_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        filter.insert("eventId", v);
    }
    if let Some(s) = q.status.as_deref().filter(|s| *s != "all") {
        filter.insert("status", s);
    }
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["slug", "headline", "description"]);
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
    let coll = mongo.collection::<SabbackstagePublicPage>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabbackstage_public_pages.find"))
    })?;
    let mut rows: Vec<SabbackstagePublicPage> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabbackstage_public_pages.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %id))]
pub async fn get_public_page(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<SabbackstagePublicPage>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabbackstagePublicPage>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabbackstage_public_pages.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabbackstage_public_page".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_public_page(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreatePublicPageInput>,
) -> Result<Json<CreatePublicPageResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = entity_from_create(input, user_id)?;
    let coll = mongo.collection::<SabbackstagePublicPage>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabbackstage_public_pages.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(CreatePublicPageResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %id))]
pub async fn update_public_page(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(patch): Json<UpdatePublicPageInput>,
) -> Result<Json<SabbackstagePublicPage>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabbackstagePublicPage>(COLL);
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabbackstage_public_pages.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("sabbackstage_public_page".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabbackstage_public_pages.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabbackstage_public_page".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %id))]
pub async fn delete_public_page(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<DeletePublicPageResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabbackstagePublicPage>(COLL);
    let result = coll
        .delete_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabbackstage_public_pages.delete"))
        })?;
    Ok(Json(DeletePublicPageResponse {
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
    let coll = mongo.collection::<SabbackstagePublicPage>(COLL);
    let row = coll
        .find_one(doc! { "slug": &slug_norm, "status": "live" })
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabbackstage_public_pages.public_find"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("sabbackstage_public_page".to_owned()))?;
    let user_id = row.user_id.to_hex();
    let event_id = row.event_id.to_hex();
    Ok(Json(PublicPageView {
        user_id,
        event_id,
        page: row,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_normalizes_slug() {
        let user_id = ObjectId::new();
        let input = CreatePublicPageInput {
            event_id: ObjectId::new().to_hex(),
            slug: " Foo-BAR ".into(),
            headline: "Foo".into(),
            ..Default::default()
        };
        let p = entity_from_create(input, user_id).unwrap();
        assert_eq!(p.slug, "foo-bar");
        assert_eq!(p.status, "draft");
    }

    #[test]
    fn create_requires_slug_and_headline() {
        let user_id = ObjectId::new();
        let bad_slug = CreatePublicPageInput {
            event_id: ObjectId::new().to_hex(),
            slug: "  ".into(),
            headline: "h".into(),
            ..Default::default()
        };
        assert!(entity_from_create(bad_slug, user_id).is_err());
        let bad_headline = CreatePublicPageInput {
            event_id: ObjectId::new().to_hex(),
            slug: "foo".into(),
            headline: "  ".into(),
            ..Default::default()
        };
        assert!(entity_from_create(bad_headline, user_id).is_err());
    }
}
