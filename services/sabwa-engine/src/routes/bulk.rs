//! `/bulk` — bulk-send campaign lifecycle.
//!
//! Implements server actions from SABWA_PLAN.md §13: `startBulkCampaign`,
//! `pauseBulkCampaign`, `resumeBulkCampaign`, `abortBulkCampaign`. Campaigns
//! are paced by the worker — this route just records intent and pushes a
//! control signal onto the per-campaign Redis queue.

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

/// Build the `/bulk` sub-router.
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_campaigns).post(start_campaign))
        .route("/:id", get(get_campaign))
        .route("/:id/pause", post(pause_campaign))
        .route("/:id/resume", post(resume_campaign))
        .route("/:id/abort", post(abort_campaign))
}

// ---------- DTOs ----------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartCampaignRequest {
    pub session_id: String,
    pub project_id: String,
    pub name: String,
    pub recipients: Vec<String>,
    pub payload: JsonValue,
    /// Messages-per-minute target, capped by the session's rate profile.
    pub rate_per_minute: Option<u32>,
    /// Jitter window in seconds applied to each send.
    pub jitter_seconds: Option<u32>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartCampaignResponse {
    pub campaign_id: String,
    pub queue_key: String,
    pub status: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListCampaignsQuery {
    pub session_id: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CampaignSummary {
    pub campaign_id: String,
    pub session_id: String,
    pub name: String,
    pub status: String,
    pub total: u32,
    pub sent: u32,
    pub failed: u32,
    pub started_at: Option<chrono::DateTime<chrono::Utc>>,
    pub finished_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListCampaignsResponse {
    pub campaigns: Vec<CampaignSummary>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CampaignDetail {
    pub campaign_id: String,
    pub session_id: String,
    pub name: String,
    pub status: String,
    pub total: u32,
    pub sent: u32,
    pub failed: u32,
    pub rate_per_minute: Option<u32>,
    pub jitter_seconds: Option<u32>,
    pub started_at: Option<chrono::DateTime<chrono::Utc>>,
    pub finished_at: Option<chrono::DateTime<chrono::Utc>>,
    pub payload: JsonValue,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ControlResponse {
    pub campaign_id: String,
    pub op: String,
    pub queued: bool,
}

// ---------- Handlers ----------

async fn start_campaign(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<StartCampaignRequest>,
) -> Result<Json<StartCampaignResponse>, AppError> {
    tracing::info!(
        session_id = %body.session_id,
        name = %body.name,
        recipient_count = body.recipients.len(),
        "bulk: start"
    );

    let (actor_ip, user_agent) = audit::extract_context(&headers);

    let campaign_id = format!("camp_{}", uuid::Uuid::new_v4());

    crate::db::misc::insert_campaign(
        &state.db,
        &campaign_id,
        &body.project_id,
        &body.session_id,
        &body.name,
        &body.recipients,
        &body.payload,
        body.rate_per_minute,
        body.jitter_seconds,
    )
    .await?;

    // Per-campaign queue gives the worker an isolated paced channel.
    let queue_key = format!("sabwa:bulk:{}", campaign_id);
    let control_key = format!("sabwa:{}:bulk:control", body.session_id);
    let payload = serde_json::json!({
        "op": "campaign_start",
        "campaignId": campaign_id,
        "queueKey": queue_key,
    });
    crate::db::misc::redis_lpush(&state.redis, &control_key, &payload.to_string()).await?;

    let _ = audit::record(
        &state,
        AuditEntry {
            project_id: body.project_id.clone(),
            user_id: None,
            session_id: Some(body.session_id.clone()),
            action: "bulk.start".into(),
            target_kind: Some("campaign".into()),
            target_id: Some(campaign_id.clone()),
            metadata: serde_json::json!({
                "name": body.name,
                "recipientCount": body.recipients.len(),
                "ratePerMinute": body.rate_per_minute,
                "jitterSeconds": body.jitter_seconds,
            }),
            actor_ip,
            user_agent,
            ts: chrono::Utc::now(),
        },
    )
    .await;

    Ok(Json(StartCampaignResponse {
        campaign_id,
        queue_key,
        status: "queued".into(),
    }))
}

async fn list_campaigns(
    State(state): State<AppState>,
    Query(q): Query<ListCampaignsQuery>,
) -> Result<Json<ListCampaignsResponse>, AppError> {
    tracing::info!(session_id = %q.session_id, "bulk: list");

    let rows = crate::db::misc::list_campaigns(&state.db, &q.session_id).await?;
    let campaigns = rows
        .into_iter()
        .map(|c| CampaignSummary {
            campaign_id: c.id,
            session_id: c.session_id,
            name: c.name,
            status: c.status,
            total: c.total,
            sent: c.sent,
            failed: c.failed,
            started_at: c.started_at,
            finished_at: c.finished_at,
        })
        .collect();

    Ok(Json(ListCampaignsResponse { campaigns }))
}

async fn get_campaign(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<CampaignDetail>, AppError> {
    tracing::info!(campaign_id = %id, "bulk: get");

    let c = crate::db::misc::get_campaign(&state.db, &id).await?;
    Ok(Json(CampaignDetail {
        campaign_id: c.id,
        session_id: c.session_id,
        name: c.name,
        status: c.status,
        total: c.total,
        sent: c.sent,
        failed: c.failed,
        rate_per_minute: c.rate_per_minute,
        jitter_seconds: c.jitter_seconds,
        started_at: c.started_at,
        finished_at: c.finished_at,
        payload: c.payload,
    }))
}

async fn pause_campaign(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<ControlResponse>, AppError> {
    tracing::info!(campaign_id = %id, "bulk: pause");
    send_control(&state, &id, "campaign_pause").await?;
    audit_control(&state, &headers, &id, "bulk.pause").await;
    Ok(Json(ControlResponse {
        campaign_id: id,
        op: "pause".into(),
        queued: true,
    }))
}

async fn resume_campaign(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<ControlResponse>, AppError> {
    tracing::info!(campaign_id = %id, "bulk: resume");
    send_control(&state, &id, "campaign_resume").await?;
    audit_control(&state, &headers, &id, "bulk.resume").await;
    Ok(Json(ControlResponse {
        campaign_id: id,
        op: "resume".into(),
        queued: true,
    }))
}

async fn abort_campaign(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<ControlResponse>, AppError> {
    tracing::info!(campaign_id = %id, "bulk: abort");
    send_control(&state, &id, "campaign_abort").await?;
    audit_control(&state, &headers, &id, "bulk.abort").await;
    Ok(Json(ControlResponse {
        campaign_id: id,
        op: "abort".into(),
        queued: true,
    }))
}

async fn audit_control(state: &AppState, headers: &HeaderMap, campaign_id: &str, action: &str) {
    let (actor_ip, user_agent) = audit::extract_context(headers);
    let _ = audit::record(
        state,
        AuditEntry {
            project_id: String::new(),
            user_id: None,
            session_id: None,
            action: action.into(),
            target_kind: Some("campaign".into()),
            target_id: Some(campaign_id.into()),
            metadata: serde_json::json!({}),
            actor_ip,
            user_agent,
            ts: chrono::Utc::now(),
        },
    )
    .await;
}

async fn send_control(state: &AppState, campaign_id: &str, op: &str) -> Result<(), AppError> {
    let session_id = crate::db::misc::get_campaign_session(&state.db, campaign_id).await?;
    let control_key = format!("sabwa:{}:bulk:control", session_id);
    let payload = serde_json::json!({
        "op": op,
        "campaignId": campaign_id,
    });
    crate::db::misc::redis_lpush(&state.redis, &control_key, &payload.to_string())
        .await
        .map_err(AppError::from)
}
