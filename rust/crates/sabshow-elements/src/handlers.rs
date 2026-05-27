//! HTTP handlers for `/v1/sabshow/elements/*`.

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
    CreateElementInput, ElementEnvelope, ElementListResponse, ListElementsQuery,
    UpdateElementInput,
};
use crate::types::SabshowElement;

const ELEMENTS_COLL: &str = "sabshow_elements";
const SLIDES_COLL: &str = "sabshow_slides";
const DECKS_COLL: &str = "sabshow_decks";

fn user_oid(a: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&a.user_id).map_err(|_| ApiError::Unauthorized("bad user".into()))
}
fn oid(s: &str, label: &str) -> Result<ObjectId> {
    ObjectId::parse_str(s).map_err(|_| ApiError::BadRequest(format!("invalid {label}")))
}

/// Confirm the caller can mutate elements on this slide. Returns
/// `(deckId, slideId)` for downstream use.
async fn resolve_slide(
    mongo: &MongoHandle,
    slide_oid: ObjectId,
    me: ObjectId,
) -> Result<ObjectId> {
    let slide = mongo
        .db()
        .collection::<Document>(SLIDES_COLL)
        .find_one(doc! { "_id": slide_oid })
        .await
        .map_err(|e| ApiError::Internal(e.into()))?
        .ok_or_else(|| ApiError::NotFound("slide not found".into()))?;
    let deck_id = slide
        .get_object_id("deckId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("slide missing deckId")))?;
    let visible = mongo
        .db()
        .collection::<Document>(DECKS_COLL)
        .find_one(doc! {
            "_id": deck_id,
            "$or": [{ "ownerUserId": me }, { "sharedWithUserIds": me }],
        })
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    if visible.is_none() {
        return Err(ApiError::Forbidden("deck not accessible".into()));
    }
    Ok(deck_id)
}

#[instrument(skip(mongo, auth))]
pub async fn list_elements(
    State(mongo): State<MongoHandle>,
    auth: AuthUser,
    Query(q): Query<ListElementsQuery>,
) -> Result<Json<ElementListResponse>> {
    let me = user_oid(&auth)?;
    let filter = if let Some(s) = q.slide_id.as_deref().filter(|s| !s.is_empty()) {
        let sid = oid(s, "slideId")?;
        resolve_slide(&mongo, sid, me).await?;
        doc! { "slideId": sid }
    } else if let Some(d) = q.deck_id.as_deref().filter(|s| !s.is_empty()) {
        let did = oid(d, "deckId")?;
        // Visibility check via the deck.
        let visible = mongo
            .db()
            .collection::<Document>(DECKS_COLL)
            .find_one(doc! {
                "_id": did,
                "$or": [{ "ownerUserId": me }, { "sharedWithUserIds": me }],
            })
            .await
            .map_err(|e| ApiError::Internal(e.into()))?;
        if visible.is_none() {
            return Err(ApiError::Forbidden("deck not accessible".into()));
        }
        doc! { "deckId": did }
    } else {
        return Err(ApiError::BadRequest(
            "slideId or deckId is required".into(),
        ));
    };

    let coll = mongo.db().collection::<SabshowElement>(ELEMENTS_COLL);
    let opts = FindOptions::builder()
        .sort(doc! { "zIndex": 1, "createdAt": 1 })
        .build();
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    let items: Vec<SabshowElement> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    Ok(Json(ElementListResponse { items }))
}

#[instrument(skip(mongo, auth))]
pub async fn create_element(
    State(mongo): State<MongoHandle>,
    auth: AuthUser,
    Json(input): Json<CreateElementInput>,
) -> Result<Json<ElementEnvelope>> {
    let me = user_oid(&auth)?;
    let slide_oid = oid(&input.slide_id, "slideId")?;
    let deck_id = resolve_slide(&mongo, slide_oid, me).await?;

    let element = SabshowElement {
        id: None,
        slide_id: slide_oid,
        deck_id,
        user_id: me,
        kind: input.kind,
        x: input.x,
        y: input.y,
        w: input.w,
        h: input.h,
        rotation: input.rotation.unwrap_or(0.0),
        z_index: input.z_index.unwrap_or(0),
        locked: false,
        config_json: input.config_json.unwrap_or(serde_json::Value::Null),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    };
    let coll = mongo.db().collection::<SabshowElement>(ELEMENTS_COLL);
    let res = coll
        .insert_one(&element)
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    let mut out = element;
    out.id = res.inserted_id.as_object_id();
    Ok(Json(ElementEnvelope { element: out }))
}

#[instrument(skip(mongo, auth))]
pub async fn get_element(
    State(mongo): State<MongoHandle>,
    auth: AuthUser,
    Path(element_id): Path<String>,
) -> Result<Json<ElementEnvelope>> {
    let me = user_oid(&auth)?;
    let eid = oid(&element_id, "elementId")?;
    let coll = mongo.db().collection::<SabshowElement>(ELEMENTS_COLL);
    let element = coll
        .find_one(doc! { "_id": eid })
        .await
        .map_err(|e| ApiError::Internal(e.into()))?
        .ok_or_else(|| ApiError::NotFound("element not found".into()))?;
    resolve_slide(&mongo, element.slide_id, me).await?;
    Ok(Json(ElementEnvelope { element }))
}

#[instrument(skip(mongo, auth))]
pub async fn update_element(
    State(mongo): State<MongoHandle>,
    auth: AuthUser,
    Path(element_id): Path<String>,
    Json(patch): Json<UpdateElementInput>,
) -> Result<Json<ElementEnvelope>> {
    let me = user_oid(&auth)?;
    let eid = oid(&element_id, "elementId")?;
    let coll = mongo.db().collection::<SabshowElement>(ELEMENTS_COLL);
    let existing = coll
        .find_one(doc! { "_id": eid })
        .await
        .map_err(|e| ApiError::Internal(e.into()))?
        .ok_or_else(|| ApiError::NotFound("element not found".into()))?;
    resolve_slide(&mongo, existing.slide_id, me).await?;

    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.x {
        set.insert("x", v);
    }
    if let Some(v) = patch.y {
        set.insert("y", v);
    }
    if let Some(v) = patch.w {
        set.insert("w", v);
    }
    if let Some(v) = patch.h {
        set.insert("h", v);
    }
    if let Some(v) = patch.rotation {
        set.insert("rotation", v);
    }
    if let Some(v) = patch.z_index {
        set.insert("zIndex", v);
    }
    if let Some(v) = patch.locked {
        set.insert("locked", v);
    }
    if let Some(v) = patch.config_json {
        set.insert(
            "configJson",
            bson::to_bson(&v).map_err(|e| ApiError::Internal(e.into()))?,
        );
    }
    coll.update_one(doc! { "_id": eid }, doc! { "$set": set })
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    let element = coll
        .find_one(doc! { "_id": eid })
        .await
        .map_err(|e| ApiError::Internal(e.into()))?
        .ok_or_else(|| ApiError::NotFound("element not found".into()))?;
    Ok(Json(ElementEnvelope { element }))
}

#[instrument(skip(mongo, auth))]
pub async fn delete_element(
    State(mongo): State<MongoHandle>,
    auth: AuthUser,
    Path(element_id): Path<String>,
) -> Result<Json<serde_json::Value>> {
    let me = user_oid(&auth)?;
    let eid = oid(&element_id, "elementId")?;
    let coll = mongo.db().collection::<SabshowElement>(ELEMENTS_COLL);
    let existing = coll
        .find_one(doc! { "_id": eid })
        .await
        .map_err(|e| ApiError::Internal(e.into()))?
        .ok_or_else(|| ApiError::NotFound("element not found".into()))?;
    resolve_slide(&mongo, existing.slide_id, me).await?;
    coll.delete_one(doc! { "_id": eid })
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    Ok(Json(serde_json::json!({ "deleted": true })))
}
