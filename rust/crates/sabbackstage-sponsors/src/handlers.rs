//! HTTP handlers for sabbackstage-sponsors.

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
    CreateSponsorInput, CreateSponsorResponse, DeleteSponsorResponse, ListQuery, ListResponse,
    UpdateSponsorInput,
};
use crate::types::SabbackstageSponsor;

const COLL: &str = "sabbackstage_sponsors";

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn entity_from_create(input: CreateSponsorInput, user_id: ObjectId) -> Result<SabbackstageSponsor> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    if input.tier.trim().is_empty() {
        return Err(ApiError::Validation("tier is required".to_owned()));
    }
    let event_id = ObjectId::parse_str(input.event_id.trim())
        .map_err(|_| ApiError::Validation("eventId must be a valid ObjectId".to_owned()))?;
    Ok(SabbackstageSponsor {
        id: None,
        user_id,
        event_id,
        name: input.name.trim().to_owned(),
        tier: input.tier.trim().to_lowercase(),
        logo_file_id: input.logo_file_id,
        website_url: input.website_url,
        contact_email: input.contact_email,
        order_rank: input.order_rank.unwrap_or(0),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateSponsorInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch.tier {
        set.insert("tier", v.to_lowercase());
    }
    if let Some(v) = patch.logo_file_id {
        set.insert("logoFileId", v);
    }
    if let Some(v) = patch.website_url {
        set.insert("websiteUrl", v);
    }
    if let Some(v) = patch.contact_email {
        set.insert("contactEmail", v);
    }
    if let Some(v) = patch.order_rank {
        set.insert("orderRank", v);
    }
    doc! { "$set": set }
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_sponsors(
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
    if let Some(t) = q.tier.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("tier", t.to_lowercase());
    }
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "tier", "contactEmail"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "orderRank": 1, "name": 1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<SabbackstageSponsor>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabbackstage_sponsors.find"))
    })?;
    let mut rows: Vec<SabbackstageSponsor> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabbackstage_sponsors.collect"))
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
pub async fn get_sponsor(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<SabbackstageSponsor>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabbackstageSponsor>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabbackstage_sponsors.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabbackstage_sponsor".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_sponsor(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateSponsorInput>,
) -> Result<Json<CreateSponsorResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = entity_from_create(input, user_id)?;
    let coll = mongo.collection::<SabbackstageSponsor>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabbackstage_sponsors.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(CreateSponsorResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %id))]
pub async fn update_sponsor(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(patch): Json<UpdateSponsorInput>,
) -> Result<Json<SabbackstageSponsor>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabbackstageSponsor>(COLL);
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabbackstage_sponsors.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("sabbackstage_sponsor".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabbackstage_sponsors.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabbackstage_sponsor".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %id))]
pub async fn delete_sponsor(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<DeleteSponsorResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabbackstageSponsor>(COLL);
    let result = coll
        .delete_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabbackstage_sponsors.delete"))
        })?;
    Ok(Json(DeleteSponsorResponse {
        deleted: result.deleted_count > 0,
    }))
}

/// Public — unauthenticated. Lists sponsors for an event, ordered
/// for display.
#[instrument(skip_all, fields(event_id = %event_id))]
pub async fn public_list_by_event(
    State(mongo): State<MongoHandle>,
    Path(event_id): Path<String>,
) -> Result<Json<Vec<SabbackstageSponsor>>> {
    let oid = ObjectId::parse_str(event_id.trim())
        .map_err(|_| ApiError::Validation("eventId must be a valid ObjectId".to_owned()))?;
    let coll = mongo.collection::<SabbackstageSponsor>(COLL);
    let opts = FindOptions::builder()
        .sort(doc! { "tier": 1, "orderRank": 1, "name": 1 })
        .build();
    let cursor = coll
        .find(doc! { "eventId": oid })
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabbackstage_sponsors.public_find"))
        })?;
    let rows: Vec<SabbackstageSponsor> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabbackstage_sponsors.public_collect"))
    })?;
    Ok(Json(rows))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_normalizes_tier() {
        let user_id = ObjectId::new();
        let input = CreateSponsorInput {
            event_id: ObjectId::new().to_hex(),
            name: "Acme".into(),
            tier: " PLATINUM ".into(),
            ..Default::default()
        };
        let e = entity_from_create(input, user_id).unwrap();
        assert_eq!(e.tier, "platinum");
    }

    #[test]
    fn create_requires_name_and_tier() {
        let user_id = ObjectId::new();
        let bad_name = CreateSponsorInput {
            event_id: ObjectId::new().to_hex(),
            name: "".into(),
            tier: "gold".into(),
            ..Default::default()
        };
        assert!(entity_from_create(bad_name, user_id).is_err());
        let bad_tier = CreateSponsorInput {
            event_id: ObjectId::new().to_hex(),
            name: "Acme".into(),
            tier: "".into(),
            ..Default::default()
        };
        assert!(entity_from_create(bad_tier, user_id).is_err());
    }
}
