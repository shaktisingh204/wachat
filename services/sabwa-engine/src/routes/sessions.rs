//! `/sessions` — pairing, lifecycle and status for linked WhatsApp accounts.
//!
//! Mirrors the server actions from SABWA_PLAN.md §13 (`pairSession`,
//! `logoutSession`, `renameSession`, `listSessions`) plus a status endpoint
//! used by the browser as a polling fallback when SSE is unavailable.

use axum::{
    extract::{Path, Query, State},
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};

use crate::error::AppError;
use crate::state::AppState;

/// Build the `/sessions` sub-router.
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_sessions).post(create_session))
        .route(
            "/:id",
            get(get_session).delete(delete_session).patch(update_session),
        )
        .route("/:id/status", get(get_session_status))
}

// ---------- DTOs ----------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSessionRequest {
    pub project_id: String,
    pub user_id: String,
    /// `qr` or `code`.
    pub pair_method: String,
    pub phone_e164: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSessionResponse {
    pub session_id: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub qr: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pair_code: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListSessionsQuery {
    pub project_id: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionSummary {
    pub session_id: String,
    pub project_id: String,
    pub user_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub phone_e164: Option<String>,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub push_name: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListSessionsResponse {
    pub sessions: Vec<SessionSummary>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSessionRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    /// `safe` | `normal` | `aggressive`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rate_limit_profile: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionStatusResponse {
    pub session_id: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub qr: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pair_code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_connected_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeletedResponse {
    pub session_id: String,
    pub deleted: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatedResponse {
    pub session_id: String,
    pub updated: bool,
}

// ---------- Handlers ----------

async fn create_session(
    State(state): State<AppState>,
    Json(body): Json<CreateSessionRequest>,
) -> Result<Json<CreateSessionResponse>, AppError> {
    tracing::info!(
        project_id = %body.project_id,
        user_id = %body.user_id,
        pair_method = %body.pair_method,
        "sessions: create"
    );

    // Phase 1: synthesize a session id; the WA pool only knows about session
    // ids today. Real persistence (sabwa_sessions insert) lands in Phase 2
    // alongside the proper request_pair signature wiring through `AppState`.
    let session_id = format!("sess_{}", uuid::Uuid::new_v4());
    let method = match body.pair_method.as_str() {
        "code" => crate::wa::session::PairMethod::Code,
        _ => crate::wa::session::PairMethod::Qr,
    };
    let pair_req = crate::wa::session::PairRequest {
        method,
        phone_e164: body.phone_e164,
    };
    let pair = crate::wa::pool::request_pair(&state, &session_id, pair_req).await?;

    Ok(Json(CreateSessionResponse {
        session_id,
        status: "pending".into(),
        qr: pair.qr,
        pair_code: pair.pair_code,
    }))
}

async fn list_sessions(
    State(state): State<AppState>,
    Query(query): Query<ListSessionsQuery>,
) -> Result<Json<ListSessionsResponse>, AppError> {
    tracing::info!(project_id = %query.project_id, "sessions: list");

    let docs = crate::db::sessions::list_by_project(&state.db, &query.project_id).await?;
    let sessions = docs
        .into_iter()
        .map(|s| SessionSummary {
            session_id: s.id,
            project_id: s.project_id,
            user_id: s.user_id,
            phone_e164: s.phone_e164,
            status: s.status,
            push_name: s.push_name,
        })
        .collect();

    Ok(Json(ListSessionsResponse { sessions }))
}

async fn get_session(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<SessionSummary>, AppError> {
    tracing::info!(session_id = %id, "sessions: get");

    let s = crate::db::sessions::get(&state.db, &id).await?;
    Ok(Json(SessionSummary {
        session_id: s.id,
        project_id: s.project_id,
        user_id: s.user_id,
        phone_e164: s.phone_e164,
        status: s.status,
        push_name: s.push_name,
    }))
}

async fn delete_session(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<DeletedResponse>, AppError> {
    tracing::info!(session_id = %id, "sessions: delete");

    // TODO: provided by agent Rx — logout closes the live Baileys socket
    // before we drop persisted state.
    crate::wa::pool::logout(&state, &id).await?;
    crate::db::sessions::delete(&state.db, &id).await?;

    Ok(Json(DeletedResponse {
        session_id: id,
        deleted: true,
    }))
}

async fn update_session(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(body): Json<UpdateSessionRequest>,
) -> Result<Json<UpdatedResponse>, AppError> {
    tracing::info!(session_id = %id, "sessions: update");

    crate::db::sessions::update(&state.db, &id, body.label.as_deref(), body.rate_limit_profile.as_deref()).await?;

    Ok(Json(UpdatedResponse {
        session_id: id,
        updated: true,
    }))
}

async fn get_session_status(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<SessionStatusResponse>, AppError> {
    tracing::info!(session_id = %id, "sessions: status");

    // TODO: provided by agent Rx — `status` reads from the live worker pool
    // (current QR / pair code if pending, otherwise connection state).
    let status = crate::wa::pool::status(&state, &id).await?;

    Ok(Json(SessionStatusResponse {
        session_id: id,
        status: status.status,
        qr: status.qr,
        pair_code: status.pair_code,
        last_connected_at: status.last_connected_at,
    }))
}
