//! HTTP handlers for sabwriter-presence.

use axum::{
    Json,
    extract::{Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::{Duration, Utc};
use crm_common::tenant::user_oid;
use futures::TryStreamExt;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{HeartbeatInput, HeartbeatResponse, ListQuery, PresenceListResponse};
use crate::types::SabwriterPresence;

const COLL: &str = "sabwriter_presence";
const DOCS_COLL: &str = "sabwriter_documents";

fn now_bson() -> BsonDateTime {
    BsonDateTime::from_chrono(Utc::now())
}

async fn assert_doc_access(
    mongo: &MongoHandle,
    user_id: ObjectId,
    document_id: ObjectId,
) -> Result<()> {
    let coll = mongo.collection::<Document>(DOCS_COLL);
    let _ = coll
        .find_one(doc! {
            "_id": document_id,
            "$or": [
                { "userId": user_id },
                { "sharedWithUserIds": user_id },
            ]
        })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabwriter_documents.find_one")))?
        .ok_or_else(|| ApiError::NotFound("sabwriter_document".to_owned()))?;
    Ok(())
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_presence(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<PresenceListResponse>> {
    let user_id = user_oid(&user)?;
    let doc_oid = oid_from_str(&q.document_id)?;
    assert_doc_access(&mongo, user_id, doc_oid).await?;

    let cutoff_secs = q.cutoff_seconds.unwrap_or(60) as i64;
    let cutoff = Utc::now() - Duration::seconds(cutoff_secs);
    let cutoff_bson = BsonDateTime::from_chrono(cutoff);

    let coll = mongo.collection::<SabwriterPresence>(COLL);
    let cursor = coll
        .find(doc! { "documentId": doc_oid, "lastSeenAt": { "$gte": cutoff_bson } })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabwriter_presence.find")))?;
    let items: Vec<SabwriterPresence> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabwriter_presence.collect")))?;
    Ok(Json(PresenceListResponse { items }))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn heartbeat(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<HeartbeatInput>,
) -> Result<Json<HeartbeatResponse>> {
    let user_id = user_oid(&user)?;
    let doc_oid = oid_from_str(&input.document_id)?;
    assert_doc_access(&mongo, user_id, doc_oid).await?;

    let coll = mongo.collection::<Document>(COLL);
    let mut set = doc! {
        "documentId": doc_oid,
        "userId": user_id,
        "lastSeenAt": now_bson(),
    };
    if let Some(c) = input.cursor {
        set.insert("cursor", bson::to_bson(&c).unwrap_or(bson::Bson::Null));
    }
    if let Some(col) = input.color {
        set.insert("color", col);
    } else {
        set.insert("color", "#7C5CFF");
    }
    if let Some(name) = input.display_name {
        set.insert("displayName", name);
    }

    coll.update_one(
        doc! { "documentId": doc_oid, "userId": user_id },
        doc! { "$set": set },
    )
    .upsert(true)
    .await
    .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabwriter_presence.upsert")))?;
    Ok(Json(HeartbeatResponse { ok: true }))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn leave(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<HeartbeatResponse>> {
    let user_id = user_oid(&user)?;
    let doc_oid = oid_from_str(&q.document_id)?;
    let coll = mongo.collection::<Document>(COLL);
    coll.delete_one(doc! { "documentId": doc_oid, "userId": user_id })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabwriter_presence.delete")))?;
    Ok(Json(HeartbeatResponse { ok: true }))
}
