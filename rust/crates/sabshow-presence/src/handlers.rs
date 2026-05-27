//! HTTP handlers for `/v1/sabshow/presence/*`.
//!
//! Presence is the polling fallback for the real-time WebSocket
//! transport (`src/lib/sabshow/transport.ts`). The editor heartbeats the
//! caller's cursor every ~5s; everyone else polls `/list` at the same
//! cadence.

use axum::{
    Json,
    extract::{Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use mongodb::options::UpdateOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use tracing::instrument;

use crate::dto::{HeartbeatInput, PresenceListQuery, PresenceListResponse};
use crate::types::SabshowPresence;

const PRESENCE_COLL: &str = "sabshow_presence";
const DECKS_COLL: &str = "sabshow_decks";

fn user_oid(a: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&a.user_id).map_err(|_| ApiError::Unauthorized("bad user".into()))
}
fn oid(s: &str, label: &str) -> Result<ObjectId> {
    ObjectId::parse_str(s).map_err(|_| ApiError::BadRequest(format!("invalid {label}")))
}

async fn assert_deck_visible(mongo: &MongoHandle, deck_oid: ObjectId, me: ObjectId) -> Result<()> {
    let v = mongo
        .db()
        .collection::<Document>(DECKS_COLL)
        .find_one(doc! {
            "_id": deck_oid,
            "$or": [{ "ownerUserId": me }, { "sharedWithUserIds": me }],
        })
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    if v.is_none() {
        return Err(ApiError::Forbidden("deck not accessible".into()));
    }
    Ok(())
}

#[instrument(skip(mongo, auth))]
pub async fn list_presence(
    State(mongo): State<MongoHandle>,
    auth: AuthUser,
    Query(q): Query<PresenceListQuery>,
) -> Result<Json<PresenceListResponse>> {
    let me = user_oid(&auth)?;
    let deck_id = oid(&q.deck_id, "deckId")?;
    assert_deck_visible(&mongo, deck_id, me).await?;
    let coll = mongo.db().collection::<SabshowPresence>(PRESENCE_COLL);
    let cursor = coll
        .find(doc! { "deckId": deck_id })
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    let items: Vec<SabshowPresence> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    Ok(Json(PresenceListResponse { items }))
}

#[instrument(skip(mongo, auth))]
pub async fn heartbeat(
    State(mongo): State<MongoHandle>,
    auth: AuthUser,
    Json(input): Json<HeartbeatInput>,
) -> Result<Json<serde_json::Value>> {
    let me = user_oid(&auth)?;
    let deck_id = oid(&input.deck_id, "deckId")?;
    let slide_id = oid(&input.slide_id, "slideId")?;
    assert_deck_visible(&mongo, deck_id, me).await?;

    let mut set = doc! {
        "deckId": deck_id,
        "slideId": slide_id,
        "userId": me,
        "color": input.color,
        "lastSeenAt": BsonDateTime::from_chrono(Utc::now()),
    };
    if let (Some(x), Some(y)) = (input.cursor_x, input.cursor_y) {
        set.insert("cursor", doc! { "x": x, "y": y });
    }
    if let Some(sel) = input
        .selected_element_id
        .as_deref()
        .filter(|s| !s.is_empty())
    {
        set.insert("selectedElementId", oid(sel, "selectedElementId")?);
    }

    let coll = mongo.db().collection::<Document>(PRESENCE_COLL);
    coll.update_one(
        doc! { "deckId": deck_id, "userId": me },
        doc! { "$set": set },
    )
    .with_options(UpdateOptions::builder().upsert(true).build())
    .await
    .map_err(|e| ApiError::Internal(e.into()))?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

#[instrument(skip(mongo, auth))]
pub async fn disconnect(
    State(mongo): State<MongoHandle>,
    auth: AuthUser,
    Query(q): Query<PresenceListQuery>,
) -> Result<Json<serde_json::Value>> {
    let me = user_oid(&auth)?;
    let deck_id = oid(&q.deck_id, "deckId")?;
    let coll = mongo.db().collection::<Document>(PRESENCE_COLL);
    coll.delete_one(doc! { "deckId": deck_id, "userId": me })
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    Ok(Json(serde_json::json!({ "ok": true })))
}
