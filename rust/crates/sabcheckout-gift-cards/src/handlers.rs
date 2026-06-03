//! HTTP handlers for SabCheckout GiftCards.

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
    CreateGiftCardInput, CreateGiftCardResponse, DeleteGiftCardResponse, ListQuery,
    UpdateGiftCardInput,
};
use crate::types::SabcheckoutGiftCard;

const COLL: &str = "sabcheckout_gift_cards";

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

fn gift_card_from_create(
    input: CreateGiftCardInput,
    user_id: ObjectId,
) -> Result<SabcheckoutGiftCard> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }

    Ok(SabcheckoutGiftCard {
        id: None,
        user_id,
        name: input.name.trim().to_owned(),
        description: input.description,
        status: input.status.unwrap_or_else(|| "draft".to_owned()),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateGiftCardInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    doc! { "$set": set }
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabcheckoutGiftCard>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_gift_cards(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "description"]);
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
    let coll = mongo.collection::<SabcheckoutGiftCard>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcheckout_gift_cards.find"))
    })?;
    let mut rows: Vec<SabcheckoutGiftCard> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcheckout_gift_cards.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, gift_card_id = %gift_card_id))]
pub async fn get_gift_card(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(gift_card_id): Path<String>,
) -> Result<Json<SabcheckoutGiftCard>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&gift_card_id)?;
    let coll = mongo.collection::<SabcheckoutGiftCard>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcheckout_gift_cards.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabcheckout_gift_cards".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_gift_card(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateGiftCardInput>,
) -> Result<Json<CreateGiftCardResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = gift_card_from_create(input, user_id)?;
    let coll = mongo.collection::<SabcheckoutGiftCard>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcheckout_gift_cards.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(CreateGiftCardResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, gift_card_id = %gift_card_id))]
pub async fn update_gift_card(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(gift_card_id): Path<String>,
    Json(patch): Json<UpdateGiftCardInput>,
) -> Result<Json<SabcheckoutGiftCard>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&gift_card_id)?;
    let coll = mongo.collection::<SabcheckoutGiftCard>(COLL);
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcheckout_gift_cards.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("sabcheckout_gift_cards".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcheckout_gift_cards.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabcheckout_gift_cards".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, gift_card_id = %gift_card_id))]
pub async fn delete_gift_card(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(gift_card_id): Path<String>,
) -> Result<Json<DeleteGiftCardResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&gift_card_id)?;
    let coll = mongo.collection::<SabcheckoutGiftCard>(COLL);
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
            ApiError::Internal(anyhow::Error::new(e).context("sabcheckout_gift_cards.archive"))
        })?;
    Ok(Json(DeleteGiftCardResponse {
        deleted: result.matched_count > 0,
    }))
}
