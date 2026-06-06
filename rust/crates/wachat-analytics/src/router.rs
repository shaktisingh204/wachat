//! Axum router mounting the analytics endpoints under `/v1/wachat/analytics`.

use std::sync::Arc;

use axum::{
    Json, Router,
    extract::{FromRef, Path, Query, State},
    routing::{get, post},
};
use bson::doc;
use sabnode_auth::{AuthConfig, AuthUser};
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;
use wachat_types::Project;

use crate::{
    agent_hourly, agent_performance, broadcasts, conversation, dashboard_summary, local_messages,
    messaging_limit, state::WachatAnalyticsState, template,
};

const PROJECTS_COLL: &str = "projects";

async fn load_project_for(
    user: &AuthUser,
    mongo: &MongoHandle,
    project_id_hex: &str,
) -> Result<Project> {
    let oid = oid_from_str(project_id_hex)?;
    let coll = mongo.collection::<Project>(PROJECTS_COLL);
    let project = coll
        .find_one(doc! { "_id": oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
        .ok_or_else(|| ApiError::NotFound(format!("project {project_id_hex}")))?;
    if user.tenant_id != project.user_id.to_hex() {
        return Err(ApiError::Forbidden("not your project".to_owned()));
    }
    Ok(project)
}

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    WachatAnalyticsState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/projects/{id}/conversation", post(conversation_analytics))
        .route("/projects/{id}/template", post(template_analytics))
        .route(
            "/projects/{id}/messaging-limit-tier/{pnid}",
            post(messaging_limit_tier),
        )
        .route(
            "/projects/{id}/local-messages",
            post(local_message_analytics),
        )
        .route("/projects/{id}/broadcasts", post(broadcast_analytics))
        // --- Mongo-only roll-ups (GET): literal segments before param tails. ---
        .route(
            "/projects/{id}/dashboard-summary",
            get(dashboard_summary_handler),
        )
        .route(
            "/projects/{id}/agent-performance",
            get(agent_performance_handler),
        )
        .route(
            "/projects/{id}/agents/{agentId}/hourly",
            get(agent_hourly_handler),
        )
}

/// `GET /projects/{id}/dashboard-summary` — single-call overview totals +
/// 30-day daily series, replacing native `getDashboardStats`/`getDashboardChartData`.
#[instrument(skip_all)]
async fn dashboard_summary_handler(
    user: AuthUser,
    State(s): State<WachatAnalyticsState>,
    Path(id): Path<String>,
) -> Result<Json<dashboard_summary::DashboardSummary>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    Ok(Json(dashboard_summary::aggregate(&s.mongo, p.id).await?))
}

/// `GET /projects/{id}/agent-performance?days=N` — per-agent leaderboard with
/// CSAT join, for the team-performance page.
#[instrument(skip_all)]
async fn agent_performance_handler(
    user: AuthUser,
    State(s): State<WachatAnalyticsState>,
    Path(id): Path<String>,
    Query(q): Query<agent_performance::AgentPerformanceQuery>,
) -> Result<Json<agent_performance::AgentPerformanceResult>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    Ok(Json(
        agent_performance::aggregate(&s.mongo, p.id, q).await?,
    ))
}

/// `GET /projects/{id}/agents/{agentId}/hourly?days=N` — per-hour response-time
/// buckets for one agent (response-time-tracker drill-in).
#[instrument(skip_all)]
async fn agent_hourly_handler(
    user: AuthUser,
    State(s): State<WachatAnalyticsState>,
    Path((id, agent_id)): Path<(String, String)>,
    Query(q): Query<agent_hourly::HourlyQuery>,
) -> Result<Json<agent_hourly::AgentHourlyResult>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    Ok(Json(
        agent_hourly::aggregate(&s.mongo, p.id, &agent_id, q).await?,
    ))
}

async fn conversation_analytics(
    user: AuthUser,
    State(s): State<WachatAnalyticsState>,
    Path(id): Path<String>,
    Json(body): Json<conversation::ConversationAnalyticsBody>,
) -> Result<Json<conversation::ConversationAnalyticsResult>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    Ok(Json(conversation::fetch(&s.meta, &p, body).await?))
}

async fn template_analytics(
    user: AuthUser,
    State(s): State<WachatAnalyticsState>,
    Path(id): Path<String>,
    Json(body): Json<template::TemplateAnalyticsBody>,
) -> Result<Json<template::TemplateAnalyticsResult>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    Ok(Json(template::fetch(&s.meta, &p, body).await?))
}

async fn messaging_limit_tier(
    user: AuthUser,
    State(s): State<WachatAnalyticsState>,
    Path((id, pnid)): Path<(String, String)>,
) -> Result<Json<messaging_limit::MessagingLimitTier>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    Ok(Json(messaging_limit::fetch(&s.meta, &p, &pnid).await?))
}

async fn local_message_analytics(
    user: AuthUser,
    State(s): State<WachatAnalyticsState>,
    Path(id): Path<String>,
    Json(body): Json<local_messages::LocalMessageAnalyticsBody>,
) -> Result<Json<local_messages::LocalMessageAnalyticsResult>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    Ok(Json(local_messages::aggregate(&s.mongo, p.id, body).await?))
}

async fn broadcast_analytics(
    user: AuthUser,
    State(s): State<WachatAnalyticsState>,
    Path(id): Path<String>,
    Json(body): Json<broadcasts::BroadcastAnalyticsBody>,
) -> Result<Json<broadcasts::BroadcastAnalyticsResult>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    Ok(Json(broadcasts::aggregate(&s.mongo, p.id, body).await?))
}
