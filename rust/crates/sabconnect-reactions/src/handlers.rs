//! HTTP handlers for SabConnect reactions.

use axum::{
    Json,
    extract::{Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_common::tenant::user_oid;
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use std::collections::BTreeMap;
use tracing::instrument;

use crate::dto::{ListQuery, ListReactionsResponse, ToggleReactionInput, ToggleReactionResponse};
use crate::types::SabConnectReaction;

const COLL: &str = "sabconnect_reactions";

fn ownership(user_id: ObjectId, item_id: ObjectId) -> Document {
    doc! { "userId": user_id, "itemId": item_id }
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_reactions(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListReactionsResponse>> {
    let user_id = user_oid(&user)?;
    let item_id = ObjectId::parse_str(&q.item_id)
        .map_err(|_| ApiError::Validation("itemId must be ObjectId".to_owned()))?;
    let coll = mongo.collection::<SabConnectReaction>(COLL);
    let opts = FindOptions::builder().sort(doc! { "createdAt": 1 }).build();
    let cursor = coll
        .find(ownership(user_id, item_id))
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabconnect_reactions.find"))
        })?;
    let items: Vec<SabConnectReaction> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabconnect_reactions.collect"))
    })?;
    let mut count_by_emoji: BTreeMap<String, i64> = BTreeMap::new();
    for r in &items {
        *count_by_emoji.entry(r.emoji.clone()).or_insert(0) += 1;
    }
    Ok(Json(ListReactionsResponse {
        items,
        count_by_emoji,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn toggle_reaction(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<ToggleReactionInput>,
) -> Result<Json<ToggleReactionResponse>> {
    let user_id = user_oid(&user)?;
    if input.emoji.trim().is_empty() {
        return Err(ApiError::Validation("emoji is required".to_owned()));
    }
    let item_id = ObjectId::parse_str(&input.item_id)
        .map_err(|_| ApiError::Validation("itemId must be ObjectId".to_owned()))?;
    let reactor_id = ObjectId::parse_str(&input.reactor_id)
        .map_err(|_| ApiError::Validation("reactorId must be ObjectId".to_owned()))?;
    let coll = mongo.collection::<SabConnectReaction>(COLL);
    let filter = doc! {
        "userId": user_id,
        "itemId": item_id,
        "reactorId": reactor_id,
        "emoji": &input.emoji,
    };
    let existing = coll.find_one(filter.clone()).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabconnect_reactions.find_one"))
    })?;
    if let Some(_existing) = existing {
        coll.delete_one(filter).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabconnect_reactions.delete"))
        })?;
        return Ok(Json(ToggleReactionResponse {
            added: false,
            entity: None,
        }));
    }
    let now = BsonDateTime::from_chrono(Utc::now());
    let mut entity = SabConnectReaction {
        id: None,
        user_id,
        item_id,
        reactor_id,
        reactor_name: input.reactor_name,
        emoji: input.emoji,
        created_at: now,
    };
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabconnect_reactions.insert"))
    })?;
    entity.id = inserted.inserted_id.as_object_id();
    Ok(Json(ToggleReactionResponse {
        added: true,
        entity: Some(entity),
    }))
}
