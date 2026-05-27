//! HTTP handlers for `/v1/sabshow/versions/*`.
//!
//! Snapshot RESTORE is NOT implemented in this crate — restoring touches
//! `sabshow_decks` / `sabshow_slides` / `sabshow_elements` collectively,
//! which is a cross-crate operation. The TS server action coordinates
//! the restore (fetch this snapshot's `snapshotFileId` from SabFiles,
//! then replay via the other crates' POST/PATCH endpoints).

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
    CreateVersionInput, ListVersionsQuery, VersionEnvelope, VersionListResponse,
};
use crate::types::SabshowVersion;

const VERSIONS_COLL: &str = "sabshow_versions";
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
pub async fn list_versions(
    State(mongo): State<MongoHandle>,
    auth: AuthUser,
    Query(q): Query<ListVersionsQuery>,
) -> Result<Json<VersionListResponse>> {
    let me = user_oid(&auth)?;
    let deck_id = oid(&q.deck_id, "deckId")?;
    assert_deck_visible(&mongo, deck_id, me).await?;
    let limit = q.limit.unwrap_or(50).min(200);
    let coll = mongo.db().collection::<SabshowVersion>(VERSIONS_COLL);
    let opts = FindOptions::builder()
        .sort(doc! { "version": -1 })
        .limit(Some(limit as i64))
        .build();
    let cursor = coll
        .find(doc! { "deckId": deck_id })
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    let items: Vec<SabshowVersion> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    Ok(Json(VersionListResponse { items }))
}

#[instrument(skip(mongo, auth))]
pub async fn create_version(
    State(mongo): State<MongoHandle>,
    auth: AuthUser,
    Json(input): Json<CreateVersionInput>,
) -> Result<Json<VersionEnvelope>> {
    let me = user_oid(&auth)?;
    let deck_id = oid(&input.deck_id, "deckId")?;
    assert_deck_visible(&mongo, deck_id, me).await?;
    if input.snapshot_file_id.trim().is_empty() {
        return Err(ApiError::BadRequest("snapshotFileId is required".into()));
    }

    // Bump deck.version atomically and use the new value.
    let decks = mongo.db().collection::<Document>(DECKS_COLL);
    decks
        .update_one(
            doc! { "_id": deck_id, "ownerUserId": me },
            doc! { "$inc": { "version": 1 }, "$set": { "updatedAt": BsonDateTime::from_chrono(Utc::now()) } },
        )
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    let next = decks
        .find_one(doc! { "_id": deck_id })
        .await
        .map_err(|e| ApiError::Internal(e.into()))?
        .ok_or_else(|| ApiError::NotFound("deck not found".into()))?;
    let new_ver = next
        .get_i32("version")
        .map(|n| n as u32)
        .or_else(|_| next.get_i64("version").map(|n| n as u32))
        .unwrap_or(1);

    let version = SabshowVersion {
        id: None,
        deck_id,
        version: new_ver,
        saved_at: BsonDateTime::from_chrono(Utc::now()),
        saved_by: me,
        comment: input.comment,
        snapshot_file_id: input.snapshot_file_id,
        thumbnail_file_id: input.thumbnail_file_id,
    };
    let coll = mongo.db().collection::<SabshowVersion>(VERSIONS_COLL);
    let res = coll
        .insert_one(&version)
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    let mut out = version;
    out.id = res.inserted_id.as_object_id();
    Ok(Json(VersionEnvelope { version: out }))
}

#[instrument(skip(mongo, auth))]
pub async fn get_version(
    State(mongo): State<MongoHandle>,
    auth: AuthUser,
    Path(version_id): Path<String>,
) -> Result<Json<VersionEnvelope>> {
    let me = user_oid(&auth)?;
    let vid = oid(&version_id, "versionId")?;
    let coll = mongo.db().collection::<SabshowVersion>(VERSIONS_COLL);
    let version = coll
        .find_one(doc! { "_id": vid })
        .await
        .map_err(|e| ApiError::Internal(e.into()))?
        .ok_or_else(|| ApiError::NotFound("version not found".into()))?;
    assert_deck_visible(&mongo, version.deck_id, me).await?;
    Ok(Json(VersionEnvelope { version }))
}
