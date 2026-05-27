//! HTTP handlers for `/v1/sabshow/slides/*`.
//!
//! Slides live in the `sabshow_slides` Mongo collection. Visibility is
//! inherited from the parent Deck (`sabshow_decks`): the caller must own
//! or be shared into the deck before they can read or mutate any of its
//! slides.

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
    CreateSlideInput, ListSlidesQuery, ReorderSlideInput, SlideEnvelope, SlideListResponse,
    UpdateSlideInput,
};
use crate::types::{SabshowSlide, SlideLayoutKind};

const SLIDES_COLL: &str = "sabshow_slides";
const DECKS_COLL: &str = "sabshow_decks";

fn user_oid(a: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&a.user_id).map_err(|_| ApiError::Unauthorized("bad user".into()))
}
fn oid(s: &str, label: &str) -> Result<ObjectId> {
    ObjectId::parse_str(s).map_err(|_| ApiError::BadRequest(format!("invalid {label}")))
}

/// Verify the caller can read the parent deck. Returns the deck's owner id.
async fn assert_deck_visible(
    mongo: &MongoHandle,
    deck_id: ObjectId,
    me: ObjectId,
) -> Result<()> {
    let coll = mongo.db().collection::<Document>(DECKS_COLL);
    let filter = doc! {
        "_id": deck_id,
        "$or": [
            { "ownerUserId": me },
            { "sharedWithUserIds": me },
        ]
    };
    let found = coll
        .find_one(filter)
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    if found.is_none() {
        return Err(ApiError::NotFound("deck not found".into()));
    }
    Ok(())
}

#[instrument(skip(mongo, auth))]
pub async fn list_slides(
    State(mongo): State<MongoHandle>,
    auth: AuthUser,
    Query(q): Query<ListSlidesQuery>,
) -> Result<Json<SlideListResponse>> {
    let me = user_oid(&auth)?;
    let deck_id = oid(&q.deck_id, "deckId")?;
    assert_deck_visible(&mongo, deck_id, me).await?;

    let mut filter = doc! { "deckId": deck_id };
    if !q.include_hidden.unwrap_or(false) {
        filter.insert("hidden", doc! { "$ne": true });
    }
    let coll = mongo.db().collection::<SabshowSlide>(SLIDES_COLL);
    let opts = FindOptions::builder()
        .sort(doc! { "position": 1 })
        .build();
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    let items: Vec<SabshowSlide> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    Ok(Json(SlideListResponse { items }))
}

#[instrument(skip(mongo, auth))]
pub async fn create_slide(
    State(mongo): State<MongoHandle>,
    auth: AuthUser,
    Json(input): Json<CreateSlideInput>,
) -> Result<Json<SlideEnvelope>> {
    let me = user_oid(&auth)?;
    let deck_id = oid(&input.deck_id, "deckId")?;
    assert_deck_visible(&mongo, deck_id, me).await?;

    let coll = mongo.db().collection::<SabshowSlide>(SLIDES_COLL);
    // Compute insert position — append by default.
    let count = coll
        .count_documents(doc! { "deckId": deck_id })
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    let position = input.position.unwrap_or(count as u32);

    // Shift slides at/after `position` down by one.
    coll.update_many(
        doc! { "deckId": deck_id, "position": { "$gte": position } },
        doc! { "$inc": { "position": 1 } },
    )
    .await
    .map_err(|e| ApiError::Internal(e.into()))?;

    let slide = SabshowSlide {
        id: None,
        deck_id,
        user_id: me,
        position,
        layout_kind: input.layout_kind.unwrap_or(SlideLayoutKind::Blank),
        background_json: input.background_json,
        notes: None,
        title: input.title,
        thumbnail_file_id: None,
        hidden: false,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    };
    let res = coll
        .insert_one(&slide)
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    let mut out = slide;
    out.id = res.inserted_id.as_object_id();
    Ok(Json(SlideEnvelope { slide: out }))
}

#[instrument(skip(mongo, auth))]
pub async fn get_slide(
    State(mongo): State<MongoHandle>,
    auth: AuthUser,
    Path(slide_id): Path<String>,
) -> Result<Json<SlideEnvelope>> {
    let me = user_oid(&auth)?;
    let sid = oid(&slide_id, "slideId")?;
    let coll = mongo.db().collection::<SabshowSlide>(SLIDES_COLL);
    let slide = coll
        .find_one(doc! { "_id": sid })
        .await
        .map_err(|e| ApiError::Internal(e.into()))?
        .ok_or_else(|| ApiError::NotFound("slide not found".into()))?;
    assert_deck_visible(&mongo, slide.deck_id, me).await?;
    Ok(Json(SlideEnvelope { slide }))
}

#[instrument(skip(mongo, auth))]
pub async fn update_slide(
    State(mongo): State<MongoHandle>,
    auth: AuthUser,
    Path(slide_id): Path<String>,
    Json(patch): Json<UpdateSlideInput>,
) -> Result<Json<SlideEnvelope>> {
    let me = user_oid(&auth)?;
    let sid = oid(&slide_id, "slideId")?;
    let coll = mongo.db().collection::<SabshowSlide>(SLIDES_COLL);
    let existing = coll
        .find_one(doc! { "_id": sid })
        .await
        .map_err(|e| ApiError::Internal(e.into()))?
        .ok_or_else(|| ApiError::NotFound("slide not found".into()))?;
    assert_deck_visible(&mongo, existing.deck_id, me).await?;

    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.layout_kind {
        set.insert(
            "layoutKind",
            bson::to_bson(&v).map_err(|e| ApiError::Internal(e.into()))?,
        );
    }
    if let Some(v) = patch.title {
        set.insert("title", v);
    }
    if let Some(v) = patch.background_json {
        set.insert(
            "backgroundJson",
            bson::to_bson(&v).map_err(|e| ApiError::Internal(e.into()))?,
        );
    }
    if let Some(v) = patch.notes {
        set.insert("notes", v);
    }
    if let Some(v) = patch.thumbnail_file_id {
        set.insert("thumbnailFileId", v);
    }
    if let Some(v) = patch.hidden {
        set.insert("hidden", v);
    }
    coll.update_one(doc! { "_id": sid }, doc! { "$set": set })
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    let slide = coll
        .find_one(doc! { "_id": sid })
        .await
        .map_err(|e| ApiError::Internal(e.into()))?
        .ok_or_else(|| ApiError::NotFound("slide not found".into()))?;
    Ok(Json(SlideEnvelope { slide }))
}

#[instrument(skip(mongo, auth))]
pub async fn delete_slide(
    State(mongo): State<MongoHandle>,
    auth: AuthUser,
    Path(slide_id): Path<String>,
) -> Result<Json<serde_json::Value>> {
    let me = user_oid(&auth)?;
    let sid = oid(&slide_id, "slideId")?;
    let coll = mongo.db().collection::<SabshowSlide>(SLIDES_COLL);
    let existing = coll
        .find_one(doc! { "_id": sid })
        .await
        .map_err(|e| ApiError::Internal(e.into()))?
        .ok_or_else(|| ApiError::NotFound("slide not found".into()))?;
    assert_deck_visible(&mongo, existing.deck_id, me).await?;

    coll.delete_one(doc! { "_id": sid })
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    // Compact positions for the surviving siblings.
    coll.update_many(
        doc! { "deckId": existing.deck_id, "position": { "$gt": existing.position } },
        doc! { "$inc": { "position": -1 } },
    )
    .await
    .map_err(|e| ApiError::Internal(e.into()))?;
    Ok(Json(serde_json::json!({ "deleted": true })))
}

#[instrument(skip(mongo, auth))]
pub async fn duplicate_slide(
    State(mongo): State<MongoHandle>,
    auth: AuthUser,
    Path(slide_id): Path<String>,
) -> Result<Json<SlideEnvelope>> {
    let me = user_oid(&auth)?;
    let sid = oid(&slide_id, "slideId")?;
    let coll = mongo.db().collection::<SabshowSlide>(SLIDES_COLL);
    let src = coll
        .find_one(doc! { "_id": sid })
        .await
        .map_err(|e| ApiError::Internal(e.into()))?
        .ok_or_else(|| ApiError::NotFound("slide not found".into()))?;
    assert_deck_visible(&mongo, src.deck_id, me).await?;

    let new_position = src.position + 1;
    coll.update_many(
        doc! { "deckId": src.deck_id, "position": { "$gte": new_position } },
        doc! { "$inc": { "position": 1 } },
    )
    .await
    .map_err(|e| ApiError::Internal(e.into()))?;

    // NOTE: Element-row copying is handled by `sabshow-elements` —
    // the TS server action calls both crates so each crate stays
    // collection-scoped (no cross-collection writes here).
    let dup = SabshowSlide {
        id: None,
        position: new_position,
        user_id: me,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
        title: src.title.clone().map(|t| format!("{t} (copy)")),
        ..src.clone()
    };
    let res = coll
        .insert_one(&dup)
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    let mut out = dup;
    out.id = res.inserted_id.as_object_id();
    Ok(Json(SlideEnvelope { slide: out }))
}

#[instrument(skip(mongo, auth))]
pub async fn reorder_slide(
    State(mongo): State<MongoHandle>,
    auth: AuthUser,
    Path(slide_id): Path<String>,
    Json(input): Json<ReorderSlideInput>,
) -> Result<Json<SlideEnvelope>> {
    let me = user_oid(&auth)?;
    let sid = oid(&slide_id, "slideId")?;
    let coll = mongo.db().collection::<SabshowSlide>(SLIDES_COLL);
    let slide = coll
        .find_one(doc! { "_id": sid })
        .await
        .map_err(|e| ApiError::Internal(e.into()))?
        .ok_or_else(|| ApiError::NotFound("slide not found".into()))?;
    assert_deck_visible(&mongo, slide.deck_id, me).await?;

    let old_pos = slide.position;
    let new_pos = input.new_position;
    if old_pos != new_pos {
        // Shift the band [min, max] inclusive in the correct direction.
        if new_pos > old_pos {
            coll.update_many(
                doc! {
                    "deckId": slide.deck_id,
                    "position": { "$gt": old_pos, "$lte": new_pos },
                },
                doc! { "$inc": { "position": -1 } },
            )
            .await
            .map_err(|e| ApiError::Internal(e.into()))?;
        } else {
            coll.update_many(
                doc! {
                    "deckId": slide.deck_id,
                    "position": { "$gte": new_pos, "$lt": old_pos },
                },
                doc! { "$inc": { "position": 1 } },
            )
            .await
            .map_err(|e| ApiError::Internal(e.into()))?;
        }
        coll.update_one(
            doc! { "_id": sid },
            doc! { "$set": {
                "position": new_pos,
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            } },
        )
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    }
    let slide = coll
        .find_one(doc! { "_id": sid })
        .await
        .map_err(|e| ApiError::Internal(e.into()))?
        .ok_or_else(|| ApiError::NotFound("slide not found".into()))?;
    Ok(Json(SlideEnvelope { slide }))
}
