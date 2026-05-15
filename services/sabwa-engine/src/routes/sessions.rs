//! `/sessions` — pairing, lifecycle and status for linked WhatsApp accounts.
//!
//! Mirrors the server actions from SABWA_PLAN.md §13 (`pairSession`,
//! `logoutSession`, `renameSession`, `listSessions`) plus a status endpoint
//! used by the browser as a polling fallback when SSE is unavailable.

use axum::{
    extract::{Path, Query, State},
    http::HeaderMap,
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};

use crate::audit::{self, AuditEntry};
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
    headers: HeaderMap,
    Json(body): Json<CreateSessionRequest>,
) -> Result<Json<CreateSessionResponse>, AppError> {
    tracing::info!(
        project_id = %body.project_id,
        user_id = %body.user_id,
        pair_method = %body.pair_method,
        "sessions: create"
    );

    let (actor_ip, user_agent) = audit::extract_context(&headers);

    // Persist a `pending` row up front so:
    //   1. `listSessions` reflects the new account immediately.
    //   2. The connected-event persister in `wa::baileys::persist_auth_state`
    //      can resolve the session by ObjectId and flip status → connected.
    // Previously this route synthesized a `sess_<uuid>` id and skipped the
    // insert entirely, which left the auth-state persister logging
    // "session_id is not a valid ObjectId — skipping" and the overview UI
    // permanently stuck at "0 accounts".
    let project_oid = bson::oid::ObjectId::parse_str(&body.project_id)
        .map_err(|_| AppError::BadRequest(format!("invalid projectId: {}", body.project_id)))?;
    let user_oid = bson::oid::ObjectId::parse_str(&body.user_id)
        .map_err(|_| AppError::BadRequest(format!("invalid userId: {}", body.user_id)))?;
    let pair_method_db = match body.pair_method.as_str() {
        "code" => crate::db::sessions::PairMethod::Code,
        "qr" => crate::db::sessions::PairMethod::Qr,
        other => {
            return Err(AppError::BadRequest(format!(
                "pairMethod must be 'qr' or 'code', got '{other}'"
            )))
        }
    };
    let now = chrono::Utc::now();
    let pending_row = crate::db::sessions::SabwaSession {
        id: None,
        project_id: project_oid,
        user_id: user_oid,
        phone_e164: body.phone_e164.clone(),
        push_name: None,
        profile_pic_url: None,
        status: crate::db::sessions::SessionStatus::Pending,
        pair_method: pair_method_db,
        auth_state: None,
        device_meta: None,
        last_connected_at: None,
        last_seen_at: None,
        worker_node_id: None,
        ban_signals: Vec::new(),
        rate_limit_profile: crate::db::sessions::RateProfile::Normal,
        created_at: now,
        updated_at: now,
    };
    let inserted_id = crate::db::sessions::SessionsRepo::new(&state.db)
        .insert(&pending_row)
        .await?;
    let session_id = inserted_id.to_hex();

    let method = match body.pair_method.as_str() {
        "code" => crate::wa::session::PairMethod::Code,
        _ => crate::wa::session::PairMethod::Qr,
    };
    let pair_req = crate::wa::session::PairRequest {
        method,
        phone_e164: body.phone_e164.clone(),
    };
    let pair = crate::wa::pool::request_pair(&state, &session_id, pair_req).await?;

    let _ = audit::record(
        &state,
        AuditEntry {
            project_id: body.project_id.clone(),
            user_id: Some(body.user_id.clone()),
            session_id: Some(session_id.clone()),
            action: "session.pair".into(),
            target_kind: Some("session".into()),
            target_id: Some(session_id.clone()),
            metadata: serde_json::json!({
                "pairMethod": body.pair_method,
                "phoneE164": body.phone_e164,
            }),
            actor_ip,
            user_agent,
            ts: chrono::Utc::now(),
        },
    )
    .await;

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
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<DeletedResponse>, AppError> {
    tracing::info!(session_id = %id, "sessions: delete");

    let (actor_ip, user_agent) = audit::extract_context(&headers);

    // TODO: provided by agent Rx — logout closes the live Baileys socket
    // before we drop persisted state.
    crate::wa::pool::logout(&state, &id).await?;
    crate::db::sessions::delete(&state.db, &id).await?;

    let _ = audit::record(
        &state,
        AuditEntry {
            project_id: String::new(),
            user_id: None,
            session_id: Some(id.clone()),
            action: "session.logout".into(),
            target_kind: Some("session".into()),
            target_id: Some(id.clone()),
            metadata: serde_json::json!({}),
            actor_ip,
            user_agent,
            ts: chrono::Utc::now(),
        },
    )
    .await;

    Ok(Json(DeletedResponse {
        session_id: id,
        deleted: true,
    }))
}

async fn update_session(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(body): Json<UpdateSessionRequest>,
) -> Result<Json<UpdatedResponse>, AppError> {
    tracing::info!(session_id = %id, "sessions: update");

    let (actor_ip, user_agent) = audit::extract_context(&headers);

    crate::db::sessions::update(&state.db, &id, body.label.as_deref(), body.rate_limit_profile.as_deref()).await?;

    // Treat label-only changes as `session.rename` and anything else as a
    // generic `session.update`, mirroring the Next.js server-action shape.
    let action = if body.label.is_some() && body.rate_limit_profile.is_none() {
        "session.rename"
    } else {
        "session.update"
    };

    let _ = audit::record(
        &state,
        AuditEntry {
            project_id: String::new(),
            user_id: None,
            session_id: Some(id.clone()),
            action: action.into(),
            target_kind: Some("session".into()),
            target_id: Some(id.clone()),
            metadata: serde_json::json!({
                "label": body.label,
                "rateLimitProfile": body.rate_limit_profile,
            }),
            actor_ip,
            user_agent,
            ts: chrono::Utc::now(),
        },
    )
    .await;

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
