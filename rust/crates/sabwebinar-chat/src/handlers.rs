//! HTTP handlers for the SabWebinar live chat. All public — the live page
//! polls these endpoints (real-time fan-out is on the transport).

use axum::{
    Json,
    extract::{Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::{DateTime, Utc};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{ListQuery, ListResponse, SendChatInput, SendChatResponse};
use crate::types::ChatMessage;

const COLL: &str = "sabwebinar_chat";
const WEBINARS_COLL: &str = "sabwebinar_webinars";

#[derive(serde::Deserialize)]
struct WebinarLite {
    #[serde(rename = "_id")]
    id: ObjectId,
    #[serde(rename = "userId")]
    user_id: ObjectId,
}

fn parse_date(s: &str) -> Option<BsonDateTime> {
    DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|d| BsonDateTime::from_chrono(d.with_timezone(&Utc)))
}

#[instrument(skip_all)]
pub async fn list_chat_public(
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let webinar_oid = oid_from_str(&q.webinar_id)?;
    let mut filter: Document = doc! { "webinarId": webinar_oid };
    if let Some(sid) = q
        .session_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        filter.insert("sessionId", sid);
    }
    if let Some(since) = q.since.as_deref().and_then(parse_date) {
        filter.insert("ts", doc! { "$gt": since });
    }
    let limit = q.limit.unwrap_or(200).min(500) as i64;
    let opts = FindOptions::builder()
        .sort(doc! { "ts": 1 })
        .limit(limit)
        .build();
    let coll = mongo.collection::<ChatMessage>(COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabwebinar_chat.find"))
        })?;
    let rows: Vec<ChatMessage> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabwebinar_chat.collect"))
    })?;
    Ok(Json(ListResponse { items: rows }))
}

#[instrument(skip_all)]
pub async fn send_chat_public(
    State(mongo): State<MongoHandle>,
    Json(input): Json<SendChatInput>,
) -> Result<Json<SendChatResponse>> {
    if input.body.trim().is_empty() {
        return Err(ApiError::Validation("body is required".to_owned()));
    }
    if input.sender_name.trim().is_empty() {
        return Err(ApiError::Validation("senderName is required".to_owned()));
    }
    let webinar_oid = oid_from_str(&input.webinar_id)?;
    let webinars = mongo.collection::<WebinarLite>(WEBINARS_COLL);
    let webinar = webinars
        .find_one(doc! { "_id": webinar_oid })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabwebinar_chat.lookup_webinar"))
        })?
        .ok_or_else(|| ApiError::NotFound("webinar".to_owned()))?;

    let session_id = input
        .session_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok());

    let mut entity = ChatMessage {
        id: None,
        user_id: webinar.user_id,
        webinar_id: webinar.id,
        session_id,
        sender_name: input.sender_name.trim().to_owned(),
        sender_user_id: None,
        body: input.body.trim().to_owned(),
        ts: BsonDateTime::from_chrono(Utc::now()),
    };
    let coll = mongo.collection::<ChatMessage>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabwebinar_chat.insert")))?;
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
