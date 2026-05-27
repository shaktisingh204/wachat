//! HTTP handlers for `/v1/sabshow/decks/*`.
//!
//! Mongo collection: `sabshow_decks`. Scope rule: a deck is visible to
//! `auth.user_id` iff `ownerUserId == auth.user_id` OR
//! `auth.user_id ∈ sharedWithUserIds`. Writes require ownership.
//!
//! Bodies are intentionally lean: full Mongo plumbing follows the
//! `crm-accounts` pattern (`rust/crates/crm-accounts/src/handlers.rs`).
//! The integrator will harden these once the workspace wires the crate.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use tracing::instrument;

use crate::dto::{
    CreateDeckInput, DeckEnvelope, DeckListResponse, ListDecksQuery, ShareDeckInput,
    UpdateDeckInput,
};
use crate::types::{DeckStatus, SabshowDeck};

const DECKS_COLL: &str = "sabshow_decks";
const DEFAULT_LIMIT: u32 = 25;
const MAX_LIMIT: u32 = 100;

fn parse_user_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("invalid user id".into()))
}

fn parse_oid(s: &str, label: &str) -> Result<ObjectId> {
    ObjectId::parse_str(s)
        .map_err(|_| ApiError::BadRequest(format!("invalid {label}")))
}

/// Visibility filter — accept owner OR shared.
fn visibility_filter(user_oid: ObjectId) -> Document {
    doc! {
        "$or": [
            { "ownerUserId": user_oid },
            { "sharedWithUserIds": user_oid },
        ]
    }
}

#[instrument(skip(mongo, auth))]
pub async fn list_decks(
    State(mongo): State<MongoHandle>,
    auth: AuthUser,
    Query(q): Query<ListDecksQuery>,
) -> Result<Json<DeckListResponse>> {
    let me = parse_user_oid(&auth)?;
    let page = q.page.unwrap_or(0);
    let limit = q.limit.unwrap_or(DEFAULT_LIMIT).min(MAX_LIMIT);

    let mut filter = visibility_filter(me);
    match q.status.as_deref().unwrap_or("non_archived") {
        "all" => {}
        "draft" => {
            filter.insert("status", "draft");
        }
        "published" => {
            filter.insert("status", "published");
        }
        "archived" => {
            filter.insert("status", "archived");
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(text) = q.q.as_deref().filter(|s| !s.is_empty()) {
        filter.insert(
            "title",
            doc! { "$regex": text, "$options": "i" },
        );
    }

    let coll = mongo.db().collection::<SabshowDeck>(DECKS_COLL);
    let total = coll
        .count_documents(filter.clone())
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;

    let opts = FindOptions::builder()
        .skip(Some((page as u64) * (limit as u64)))
        .limit(Some(limit as i64))
        .sort(doc! { "updatedAt": -1, "createdAt": -1 })
        .build();
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    let items: Vec<SabshowDeck> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;

    Ok(Json(DeckListResponse {
        items,
        total,
        page,
        limit,
    }))
}

#[instrument(skip(mongo, auth))]
pub async fn create_deck(
    State(mongo): State<MongoHandle>,
    auth: AuthUser,
    Json(input): Json<CreateDeckInput>,
) -> Result<Json<DeckEnvelope>> {
    if input.title.trim().is_empty() {
        return Err(ApiError::BadRequest("title is required".into()));
    }
    let me = parse_user_oid(&auth)?;
    let theme_oid = input
        .theme_id
        .as_deref()
        .filter(|s| !s.is_empty())
        .map(|s| parse_oid(s, "themeId"))
        .transpose()?;

    let deck = SabshowDeck {
        id: None,
        owner_user_id: me,
        title: input.title,
        shared_with_user_ids: vec![],
        theme_json: input.theme_json,
        theme_id: theme_oid,
        status: DeckStatus::Draft,
        default_slide_id: None,
        version: 1,
        cover_file_id: None,
        tags: input.tags,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    };
    let coll = mongo.db().collection::<SabshowDeck>(DECKS_COLL);
    let res = coll
        .insert_one(&deck)
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    let mut out = deck;
    out.id = res.inserted_id.as_object_id();
    Ok(Json(DeckEnvelope { deck: out }))
}

#[instrument(skip(mongo, auth))]
pub async fn get_deck(
    State(mongo): State<MongoHandle>,
    auth: AuthUser,
    Path(deck_id): Path<String>,
) -> Result<Json<DeckEnvelope>> {
    let me = parse_user_oid(&auth)?;
    let oid = parse_oid(&deck_id, "deckId")?;
    let mut filter = visibility_filter(me);
    filter.insert("_id", oid);
    let coll = mongo.db().collection::<SabshowDeck>(DECKS_COLL);
    let deck = coll
        .find_one(filter)
        .await
        .map_err(|e| ApiError::Internal(e.into()))?
        .ok_or_else(|| ApiError::NotFound("deck not found".into()))?;
    Ok(Json(DeckEnvelope { deck }))
}

#[instrument(skip(mongo, auth))]
pub async fn update_deck(
    State(mongo): State<MongoHandle>,
    auth: AuthUser,
    Path(deck_id): Path<String>,
    Json(patch): Json<UpdateDeckInput>,
) -> Result<Json<DeckEnvelope>> {
    let me = parse_user_oid(&auth)?;
    let oid = parse_oid(&deck_id, "deckId")?;
    // Writes require ownership.
    let filter = doc! { "_id": oid, "ownerUserId": me };

    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.title {
        set.insert("title", v);
    }
    if let Some(v) = patch.theme_id {
        let theme_oid = parse_oid(&v, "themeId")?;
        set.insert("themeId", theme_oid);
    }
    if let Some(v) = patch.theme_json {
        set.insert(
            "themeJson",
            bson::to_bson(&v).map_err(|e| ApiError::Internal(e.into()))?,
        );
    }
    if let Some(v) = patch.default_slide_id {
        let s_oid = parse_oid(&v, "defaultSlideId")?;
        set.insert("defaultSlideId", s_oid);
    }
    if let Some(v) = patch.cover_file_id {
        set.insert("coverFileId", v);
    }
    if let Some(v) = patch.tags {
        set.insert("tags", v);
    }
    if let Some(v) = patch.status {
        let s = match v {
            DeckStatus::Draft => "draft",
            DeckStatus::Published => "published",
            DeckStatus::Archived => "archived",
        };
        set.insert("status", s);
    }

    let coll = mongo.db().collection::<SabshowDeck>(DECKS_COLL);
    coll.update_one(filter.clone(), doc! { "$set": set })
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    let deck = coll
        .find_one(filter)
        .await
        .map_err(|e| ApiError::Internal(e.into()))?
        .ok_or_else(|| ApiError::NotFound("deck not found".into()))?;
    Ok(Json(DeckEnvelope { deck }))
}

#[instrument(skip(mongo, auth))]
pub async fn delete_deck(
    State(mongo): State<MongoHandle>,
    auth: AuthUser,
    Path(deck_id): Path<String>,
) -> Result<Json<serde_json::Value>> {
    // Soft delete — sets status to "archived".
    let me = parse_user_oid(&auth)?;
    let oid = parse_oid(&deck_id, "deckId")?;
    let filter = doc! { "_id": oid, "ownerUserId": me };
    let coll = mongo.db().collection::<SabshowDeck>(DECKS_COLL);
    let res = coll
        .update_one(
            filter,
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            } },
        )
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    Ok(Json(serde_json::json!({ "archived": res.matched_count > 0 })))
}

#[instrument(skip(mongo, auth))]
pub async fn share_deck(
    State(mongo): State<MongoHandle>,
    auth: AuthUser,
    Path(deck_id): Path<String>,
    Json(input): Json<ShareDeckInput>,
) -> Result<Json<DeckEnvelope>> {
    let me = parse_user_oid(&auth)?;
    let oid = parse_oid(&deck_id, "deckId")?;
    let filter = doc! { "_id": oid, "ownerUserId": me };

    let add: Vec<ObjectId> = input
        .add_user_ids
        .iter()
        .filter_map(|s| ObjectId::parse_str(s).ok())
        .collect();
    let remove: Vec<ObjectId> = input
        .remove_user_ids
        .iter()
        .filter_map(|s| ObjectId::parse_str(s).ok())
        .collect();

    let coll = mongo.db().collection::<SabshowDeck>(DECKS_COLL);
    if !add.is_empty() {
        coll.update_one(
            filter.clone(),
            doc! { "$addToSet": { "sharedWithUserIds": { "$each": add } } },
        )
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    }
    if !remove.is_empty() {
        coll.update_one(
            filter.clone(),
            doc! { "$pullAll": { "sharedWithUserIds": remove } },
        )
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    }
    coll.update_one(
        filter.clone(),
        doc! { "$set": { "updatedAt": BsonDateTime::from_chrono(Utc::now()) } },
    )
    .await
    .map_err(|e| ApiError::Internal(e.into()))?;

    let deck = coll
        .find_one(filter)
        .await
        .map_err(|e| ApiError::Internal(e.into()))?
        .ok_or_else(|| ApiError::NotFound("deck not found".into()))?;
    Ok(Json(DeckEnvelope { deck }))
}
