//! Conversation search + per-contact timeline.
//!
//! Mirrors `searchConversations`, `getContactTimeline`.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Document, doc};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::{helpers::docs_to_json, state::WachatFeaturesState, tenancy::load_project_for};

#[derive(Debug, Deserialize)]
pub struct SearchQuery {
    pub q: String,
}

#[derive(Debug, Serialize)]
pub struct SearchResp {
    pub messages: Value,
}

pub async fn search(
    user: AuthUser,
    Path(project_id): Path<String>,
    Query(qs): Query<SearchQuery>,
    State(state): State<WachatFeaturesState>,
) -> Result<Json<SearchResp>> {
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let coll = state.mongo.collection::<Document>("messages");
    let opts = FindOptions::builder()
        .sort(doc! { "timestamp": -1 })
        .limit(50)
        .build();
    let cursor = coll
        .find(doc! {
            "projectId": project.id,
            "content.text": { "$regex": &qs.q, "$options": "i" },
        })
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    Ok(Json(SearchResp {
        messages: docs_to_json(docs),
    }))
}

#[derive(Debug, Serialize)]
pub struct TimelineResp {
    pub events: Value,
}

pub async fn timeline(
    user: AuthUser,
    Path((project_id, contact_id)): Path<(String, String)>,
    State(state): State<WachatFeaturesState>,
) -> Result<Json<TimelineResp>> {
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let messages_coll = state.mongo.collection::<Document>("messages");
    let opts = FindOptions::builder()
        .sort(doc! { "timestamp": -1 })
        .limit(50)
        .build();
    let mcursor = messages_coll
        .find(doc! { "projectId": project.id, "contactId": &contact_id })
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    let messages: Vec<Document> = mcursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;

    let notes_coll = state.mongo.collection::<Document>("wa_contact_notes");
    let nopts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .build();
    let ncursor = notes_coll
        .find(doc! { "contactId": &contact_id, "projectId": &project_id })
        .with_options(nopts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    let notes: Vec<Document> = ncursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;

    // Build event list with timestamps so we can sort.
    let mut events: Vec<(i64, serde_json::Map<String, Value>)> = Vec::new();
    for m in messages {
        let ts_ms = m
            .get_datetime("timestamp")
            .map(|d| d.timestamp_millis())
            .unwrap_or(0);
        let direction = m
            .get_str("direction")
            .ok()
            .map(|s| s.to_owned())
            .unwrap_or_default();
        let content = m
            .get_document("content")
            .ok()
            .and_then(|d| d.get_str("text").ok().map(|s| s.to_owned()))
            .or_else(|| m.get_str("type").ok().map(|s| s.to_owned()))
            .unwrap_or_default();
        let mut o = serde_json::Map::new();
        o.insert("type".into(), Value::String("message".into()));
        o.insert("direction".into(), Value::String(direction));
        o.insert("content".into(), Value::String(content));
        o.insert(
            "timestamp".into(),
            Value::String(
                bson::DateTime::from_millis(ts_ms)
                    .to_chrono()
                    .to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
            ),
        );
        events.push((ts_ms, o));
    }
    for n in notes {
        let ts_ms = n
            .get_datetime("createdAt")
            .map(|d| d.timestamp_millis())
            .unwrap_or(0);
        let text = n.get_str("text").unwrap_or("").to_owned();
        let mut o = serde_json::Map::new();
        o.insert("type".into(), Value::String("note".into()));
        o.insert("content".into(), Value::String(text));
        o.insert(
            "timestamp".into(),
            Value::String(
                bson::DateTime::from_millis(ts_ms)
                    .to_chrono()
                    .to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
            ),
        );
        events.push((ts_ms, o));
    }
    events.sort_by(|a, b| b.0.cmp(&a.0));

    Ok(Json(TimelineResp {
        events: Value::Array(events.into_iter().map(|(_, v)| Value::Object(v)).collect()),
    }))
}
