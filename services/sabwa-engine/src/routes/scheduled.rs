//! `/scheduled` — schedule, reschedule and cancel future messages.
//!
//! Implements server actions from SABWA_PLAN.md §13: `scheduleMessage`,
//! `updateScheduledMessage`, `cancelScheduledMessage`, `listScheduledMessages`.

use axum::{
    extract::{Path, Query, State},
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

use crate::error::AppError;
use crate::state::AppState;

/// Build the `/scheduled` sub-router.
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_scheduled).post(create_scheduled))
        .route(
            "/:id",
            axum::routing::patch(update_scheduled).delete(cancel_scheduled),
        )
}

// ---------- DTOs ----------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduledTarget {
    pub jid: String,
    /// `individual` | `group` | `broadcast`.
    pub r#type: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateScheduledRequest {
    pub session_id: String,
    pub project_id: String,
    /// `one_off` | `recurring`.
    pub kind: String,
    pub scheduled_for: chrono::DateTime<chrono::Utc>,
    pub cron: Option<String>,
    pub timezone: Option<String>,
    pub targets: Vec<ScheduledTarget>,
    pub payload: JsonValue,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateScheduledResponse {
    pub scheduled_id: String,
    pub bull_job_id: Option<String>,
    pub status: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListScheduledQuery {
    pub session_id: String,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduledDto {
    pub scheduled_id: String,
    pub session_id: String,
    pub kind: String,
    pub scheduled_for: chrono::DateTime<chrono::Utc>,
    pub cron: Option<String>,
    pub timezone: Option<String>,
    pub status: String,
    pub attempt_count: u32,
    pub last_error: Option<String>,
    pub sent_at: Option<chrono::DateTime<chrono::Utc>>,
    pub targets: Vec<ScheduledTarget>,
    pub payload: JsonValue,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListScheduledResponse {
    pub items: Vec<ScheduledDto>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateScheduledRequest {
    pub scheduled_for: Option<chrono::DateTime<chrono::Utc>>,
    pub cron: Option<String>,
    pub timezone: Option<String>,
    pub payload: Option<JsonValue>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateScheduledResponse {
    pub scheduled_id: String,
    pub updated: bool,
    pub bull_job_id: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CancelScheduledResponse {
    pub scheduled_id: String,
    pub cancelled: bool,
}

// ---------- Handlers ----------

async fn create_scheduled(
    State(state): State<AppState>,
    Json(body): Json<CreateScheduledRequest>,
) -> Result<Json<CreateScheduledResponse>, AppError> {
    tracing::info!(
        session_id = %body.session_id,
        kind = %body.kind,
        scheduled_for = %body.scheduled_for,
        target_count = body.targets.len(),
        "scheduled: create"
    );

    let scheduled_id = format!("sch_{}", uuid::Uuid::new_v4());

    let targets_bson: Vec<JsonValue> = body
        .targets
        .iter()
        .map(|t| serde_json::json!({ "jid": t.jid, "type": t.r#type }))
        .collect();

    crate::db::scheduled::insert(
        &state.db,
        &scheduled_id,
        &body.project_id,
        &body.session_id,
        &body.kind,
        body.scheduled_for,
        body.cron.as_deref(),
        body.timezone.as_deref(),
        &targets_bson,
        &body.payload,
    )
    .await?;

    // Enqueue onto the Redis delayed-job queue. The current `queue::enqueue`
    // takes a typed `ScheduledJob`; we adapt at the route boundary so the
    // db-side bookkeeping above can keep its string id.
    let job = crate::scheduler::queue::ScheduledJob {
        id: scheduled_id.clone(),
        session_id: body.session_id.clone(),
        project_id: body.project_id.clone(),
        scheduled_for_ts: body.scheduled_for.timestamp(),
        kind: crate::scheduler::queue::ScheduledJobKind::SendMessage,
        payload: body.payload.clone(),
    };
    let bull_job_id: Option<String> =
        match crate::scheduler::queue::enqueue(&state.redis, job).await {
            Ok(()) => Some(scheduled_id.clone()),
            Err(_) => None,
        };

    if let Some(ref job_id) = bull_job_id {
        crate::db::scheduled::set_bull_job_id(&state.db, &scheduled_id, job_id).await?;
    }

    Ok(Json(CreateScheduledResponse {
        scheduled_id,
        bull_job_id,
        status: "pending".into(),
    }))
}

async fn list_scheduled(
    State(state): State<AppState>,
    Query(q): Query<ListScheduledQuery>,
) -> Result<Json<ListScheduledResponse>, AppError> {
    tracing::info!(
        session_id = %q.session_id,
        status = ?q.status,
        "scheduled: list"
    );

    let rows = crate::db::scheduled::list(&state.db, &q.session_id, q.status.as_deref()).await?;
    let items = rows
        .into_iter()
        .map(|s| ScheduledDto {
            scheduled_id: s.id,
            session_id: s.session_id,
            kind: s.kind,
            scheduled_for: s.scheduled_for,
            cron: s.cron,
            timezone: s.timezone,
            status: s.status,
            attempt_count: s.attempt_count,
            last_error: s.last_error,
            sent_at: s.sent_at,
            targets: s
                .targets
                .into_iter()
                .map(|t| ScheduledTarget {
                    jid: t.jid,
                    r#type: t.kind,
                })
                .collect(),
            payload: s.payload,
        })
        .collect();

    Ok(Json(ListScheduledResponse { items }))
}

async fn update_scheduled(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(body): Json<UpdateScheduledRequest>,
) -> Result<Json<UpdateScheduledResponse>, AppError> {
    tracing::info!(scheduled_id = %id, "scheduled: update");

    crate::db::scheduled::update(
        &state.db,
        &id,
        body.scheduled_for,
        body.cron.as_deref(),
        body.timezone.as_deref(),
        body.payload.as_ref(),
    )
    .await?;

    // Re-enqueue with the new fire time. The underlying `reschedule` returns
    // a bool ("did the row exist?"); we translate to a Some(id) on success.
    let bull_job_id: Option<String> = if let Some(when) = body.scheduled_for {
        match crate::scheduler::queue::reschedule(&state.redis, &id, when.timestamp()).await {
            Ok(true) => Some(id.clone()),
            _ => None,
        }
    } else {
        None
    };

    if let Some(ref job_id) = bull_job_id {
        crate::db::scheduled::set_bull_job_id(&state.db, &id, job_id).await?;
    }

    Ok(Json(UpdateScheduledResponse {
        scheduled_id: id,
        updated: true,
        bull_job_id,
    }))
}

async fn cancel_scheduled(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<CancelScheduledResponse>, AppError> {
    tracing::info!(scheduled_id = %id, "scheduled: cancel");

    // Drop the delayed Redis job (best-effort) before flipping the doc status.
    let _ = crate::scheduler::queue::cancel(&state.redis, &id).await;
    crate::db::scheduled::cancel(&state.db, &id).await?;

    Ok(Json(CancelScheduledResponse {
        scheduled_id: id,
        cancelled: true,
    }))
}
