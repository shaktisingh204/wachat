//! HTTP handlers for SabPublish locations.

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
    CreateLocationInput, CreateLocationResponse, DeleteLocationResponse, ListQuery,
    UpdateLocationInput,
};
use crate::types::SabpublishLocation;

const COLL: &str = "sabpublish_locations";

fn list_filter(user_id: ObjectId, status: Option<&str>) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("__nonarchived__") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "draft" | "active" | "paused" => {
            filter.insert("status", status.unwrap());
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

fn entity_from_create(input: CreateLocationInput, user_id: ObjectId) -> SabpublishLocation {
    SabpublishLocation {
        id: None,
        user_id,
        name: input.name,
        address_line1: input.address_line1,
        address_line2: input.address_line2,
        city: input.city,
        region: input.region,
        postal_code: input.postal_code,
        country: input.country,
        lat: input.lat,
        lng: input.lng,
        phone: input.phone,
        website_url: input.website_url,
        hours_json: input.hours_json,
        categories: input.categories,
        status: Some(input.status.unwrap_or_else(|| "draft".to_owned())),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    }
}

fn build_update_doc(patch: UpdateLocationInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch.address_line1 {
        set.insert("addressLine1", v);
    }
    if let Some(v) = patch.address_line2 {
        set.insert("addressLine2", v);
    }
    if let Some(v) = patch.city {
        set.insert("city", v);
    }
    if let Some(v) = patch.region {
        set.insert("region", v);
    }
    if let Some(v) = patch.postal_code {
        set.insert("postalCode", v);
    }
    if let Some(v) = patch.country {
        set.insert("country", v);
    }
    if let Some(v) = patch.lat {
        set.insert("lat", v);
    }
    if let Some(v) = patch.lng {
        set.insert("lng", v);
    }
    if let Some(v) = patch.phone {
        set.insert("phone", v);
    }
    if let Some(v) = patch.website_url {
        set.insert("websiteUrl", v);
    }
    if let Some(v) = patch.hours_json {
        set.insert("hoursJson", v);
    }
    if let Some(v) = patch.categories {
        set.insert("categories", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    doc! { "$set": set }
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabpublishLocation>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_locations(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "city", "addressLine1"]);
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

    let coll = mongo.collection::<SabpublishLocation>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabpublish_locations.find"))
    })?;
    let mut rows: Vec<SabpublishLocation> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabpublish_locations.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, location_id = %id))]
pub async fn get_location(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<SabpublishLocation>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabpublishLocation>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabpublish_locations.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("location".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_location(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateLocationInput>,
) -> Result<Json<CreateLocationResponse>> {
    let user_id = user_oid(&user)?;
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    let mut entity = entity_from_create(input, user_id);
    let coll = mongo.collection::<SabpublishLocation>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabpublish_locations.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(CreateLocationResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, location_id = %id))]
pub async fn update_location(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(patch): Json<UpdateLocationInput>,
) -> Result<Json<SabpublishLocation>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabpublishLocation>(COLL);
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabpublish_locations.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("location".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabpublish_locations.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("location".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, location_id = %id))]
pub async fn delete_location(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<DeleteLocationResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabpublishLocation>(COLL);
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
            ApiError::Internal(anyhow::Error::new(e).context("sabpublish_locations.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("location".to_owned()));
    }
    Ok(Json(DeleteLocationResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_defaults_exclude_archived() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None);
        assert!(f.contains_key("status"));
    }

    #[test]
    fn list_filter_all_strips_status() {
        let oid = ObjectId::new();
        let f = list_filter(oid, Some("all"));
        assert!(!f.contains_key("status"));
    }

    #[test]
    fn entity_from_create_defaults_to_draft() {
        let uid = ObjectId::new();
        let input = CreateLocationInput {
            name: "Acme Cafe".into(),
            ..Default::default()
        };
        let e = entity_from_create(input, uid);
        assert_eq!(e.status.as_deref(), Some("draft"));
        assert_eq!(e.user_id, uid);
    }
}
