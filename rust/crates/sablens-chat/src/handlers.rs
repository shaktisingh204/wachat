//! HTTP handlers for SabLens in-session chat.

use axum::{
    Json,
    extract::{Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_common::{
    pagination::{clamp_limit, skip_for},
    tenant::user_oid,
};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{ListQuery, SendChatInput, SendChatResponse};
use crate::types::SablensChatMessage;

const COLL: &str = "sablens_chat";

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SablensChatMessage>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_chat(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter: Document = doc! { "userId": user_id };
    if let Some(s) = q.session_id.as_deref().filter(|s| !s.is_empty()) {
        let oid = oid_from_str(s)?;
        filter.insert("sessionId", oid);
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "ts": 1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<SablensChatMessage>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sablens_chat.find")))?;
    let mut rows: Vec<SablensChatMessage> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sablens_chat.collect")))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn send_chat(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<SendChatInput>,
) -> Result<Json<SendChatResponse>> {
    let user_id = user_oid(&user)?;
    if input.body.trim().is_empty() && input.attachment_ids.as_ref().is_none_or(|v| v.is_empty()) {
        return Err(ApiError::Validation(
            "chat message requires body or attachmentIds".to_owned(),
        ));
    }
    let session_oid = oid_from_str(&input.session_id)?;
    let now = BsonDateTime::from_chrono(Utc::now());
    let sender_kind = input.sender_kind.unwrap_or_else(|| "user".to_owned());
    let sender_user_id: Option<ObjectId> = if sender_kind == "guest" {
        None
    } else {
        Some(user_id)
    };
    let mut entity = SablensChatMessage {
        id: None,
        user_id,
        session_id: session_oid,
        ts: now,
        sender_user_id,
        sender_kind,
        body: input.body,
        attachment_ids: input.attachment_ids.unwrap_or_default(),
        created_at: now,
    };
    let coll = mongo.collection::<SablensChatMessage>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sablens_chat.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(SendChatResponse {
        id: new_id.to_hex(),
        entity,
    }))
}
