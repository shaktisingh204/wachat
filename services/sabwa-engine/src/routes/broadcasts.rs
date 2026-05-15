//! `/broadcasts` — broadcast lists and "send-as-broadcast" delivery.
//!
//! Implements server actions from SABWA_PLAN.md §13: `createBroadcastList`,
//! `updateBroadcastList`, `deleteBroadcastList`, `sendBroadcast`.

use axum::{
    extract::{Path, Query, State},
    http::HeaderMap,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

use crate::audit::{self, AuditEntry};
use crate::error::AppError;
use crate::state::AppState;

/// Build the `/broadcasts` sub-router.
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_broadcasts).post(create_broadcast))
        .route(
            "/:id",
            get(get_broadcast)
                .patch(update_broadcast)
                .delete(delete_broadcast),
        )
        .route("/:id/send", post(send_broadcast))
}

// ---------- DTOs ----------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListBroadcastsQuery {
    pub session_id: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BroadcastDto {
    pub broadcast_id: String,
    pub session_id: String,
    pub name: String,
    pub recipient_count: u32,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListBroadcastsResponse {
    pub broadcasts: Vec<BroadcastDto>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateBroadcastRequest {
    pub session_id: String,
    pub project_id: String,
    pub name: String,
    pub recipients: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateBroadcastResponse {
    pub broadcast_id: String,
    pub created: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateBroadcastRequest {
    pub name: Option<String>,
    pub recipients: Option<Vec<String>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateBroadcastResponse {
    pub broadcast_id: String,
    pub updated: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteBroadcastResponse {
    pub broadcast_id: String,
    pub deleted: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SendBroadcastRequest {
    pub session_id: String,
    pub payload: JsonValue,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SendBroadcastResponse {
    pub broadcast_id: String,
    pub queue_key: String,
    pub queued: bool,
}

// ---------- Handlers ----------

async fn list_broadcasts(
    State(state): State<AppState>,
    Query(q): Query<ListBroadcastsQuery>,
) -> Result<Json<ListBroadcastsResponse>, AppError> {
    tracing::info!(session_id = %q.session_id, "broadcasts: list");

    let rows = crate::db::misc::list_broadcasts(&state.db, &q.session_id).await?;
    let broadcasts = rows
        .into_iter()
        .map(|b| BroadcastDto {
            broadcast_id: b.id,
            session_id: b.session_id,
            name: b.name,
            recipient_count: b.recipient_count,
            created_at: b.created_at,
            updated_at: b.updated_at,
        })
        .collect();

    Ok(Json(ListBroadcastsResponse { broadcasts }))
}

async fn create_broadcast(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<CreateBroadcastRequest>,
) -> Result<Json<CreateBroadcastResponse>, AppError> {
    tracing::info!(
        session_id = %body.session_id,
        name = %body.name,
        recipient_count = body.recipients.len(),
        "broadcasts: create"
    );

    let (actor_ip, user_agent) = audit::extract_context(&headers);

    let broadcast_id = format!("bc_{}", uuid::Uuid::new_v4());
    crate::db::misc::insert_broadcast(
        &state.db,
        &broadcast_id,
        &body.project_id,
        &body.session_id,
        &body.name,
        &body.recipients,
    )
    .await?;

    let _ = audit::record(
        &state,
        AuditEntry {
            project_id: body.project_id.clone(),
            user_id: None,
            session_id: Some(body.session_id.clone()),
            action: "broadcast.create".into(),
            target_kind: Some("broadcast".into()),
            target_id: Some(broadcast_id.clone()),
            metadata: serde_json::json!({
                "name": body.name,
                "recipientCount": body.recipients.len(),
            }),
            actor_ip,
            user_agent,
            ts: chrono::Utc::now(),
        },
    )
    .await;

    Ok(Json(CreateBroadcastResponse {
        broadcast_id,
        created: true,
    }))
}

async fn get_broadcast(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<BroadcastDto>, AppError> {
    tracing::info!(broadcast_id = %id, "broadcasts: get");

    let b = crate::db::misc::get_broadcast(&state.db, &id).await?;
    Ok(Json(BroadcastDto {
        broadcast_id: b.id,
        session_id: b.session_id,
        name: b.name,
        recipient_count: b.recipient_count,
        created_at: b.created_at,
        updated_at: b.updated_at,
    }))
}

async fn update_broadcast(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(body): Json<UpdateBroadcastRequest>,
) -> Result<Json<UpdateBroadcastResponse>, AppError> {
    tracing::info!(broadcast_id = %id, "broadcasts: update");

    let (actor_ip, user_agent) = audit::extract_context(&headers);

    crate::db::misc::update_broadcast(
        &state.db,
        &id,
        body.name.as_deref(),
        body.recipients.as_deref(),
    )
    .await?;

    let _ = audit::record(
        &state,
        AuditEntry {
            project_id: String::new(),
            user_id: None,
            session_id: None,
            action: "broadcast.update".into(),
            target_kind: Some("broadcast".into()),
            target_id: Some(id.clone()),
            metadata: serde_json::json!({
                "name": body.name,
                "recipientCount": body.recipients.as_ref().map(|r| r.len()),
            }),
            actor_ip,
            user_agent,
            ts: chrono::Utc::now(),
        },
    )
    .await;

    Ok(Json(UpdateBroadcastResponse {
        broadcast_id: id,
        updated: true,
    }))
}

async fn delete_broadcast(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<DeleteBroadcastResponse>, AppError> {
    tracing::info!(broadcast_id = %id, "broadcasts: delete");

    let (actor_ip, user_agent) = audit::extract_context(&headers);

    crate::db::misc::delete_broadcast(&state.db, &id).await?;

    let _ = audit::record(
        &state,
        AuditEntry {
            project_id: String::new(),
            user_id: None,
            session_id: None,
            action: "broadcast.delete".into(),
            target_kind: Some("broadcast".into()),
            target_id: Some(id.clone()),
            metadata: serde_json::json!({}),
            actor_ip,
            user_agent,
            ts: chrono::Utc::now(),
        },
    )
    .await;

    Ok(Json(DeleteBroadcastResponse {
        broadcast_id: id,
        deleted: true,
    }))
}

async fn send_broadcast(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(body): Json<SendBroadcastRequest>,
) -> Result<Json<SendBroadcastResponse>, AppError> {
    tracing::info!(
        session_id = %body.session_id,
        broadcast_id = %id,
        "broadcasts: send"
    );

    let (actor_ip, user_agent) = audit::extract_context(&headers);

    let queue_key = format!("sabwa:{}:outbound", body.session_id);
    let payload = serde_json::json!({
        "op": "broadcast_send",
        "broadcastId": id,
        "payload": body.payload,
    });
    crate::db::misc::redis_lpush(&state.redis, &queue_key, &payload.to_string()).await?;

    let _ = audit::record(
        &state,
        AuditEntry {
            project_id: String::new(),
            user_id: None,
            session_id: Some(body.session_id.clone()),
            action: "broadcast.send".into(),
            target_kind: Some("broadcast".into()),
            target_id: Some(id.clone()),
            metadata: serde_json::json!({}),
            actor_ip,
            user_agent,
            ts: chrono::Utc::now(),
        },
    )
    .await;

    Ok(Json(SendBroadcastResponse {
        broadcast_id: id,
        queue_key,
        queued: true,
    }))
}
