//! HTTP control surface for the Next.js side (originate, hangup, pjsip config).

use axum::{
    extract::{Path, Query, State},
    http::HeaderMap,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::auth::require_token;
use crate::cdr::{self, CdrInput};
use crate::errors::{EngineError, EngineResult};
use crate::pjsip;
use crate::state::AppState;

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/v1/originate", post(originate))
        .route("/v1/channels", get(list_channels))
        .route("/v1/channels/{channelId}/hangup", post(hangup))
        .route("/v1/channels/{channelId}/hold", post(hold).delete(unhold))
        .route("/v1/channels/{channelId}/mute", post(mute).delete(unmute))
        .route("/v1/channels/{channelId}/transfer", post(transfer))
        .route("/v1/channels/{channelId}/snoop", post(snoop))
        .route("/v1/channels/{channelId}/record", post(record_channel))
        .route("/v1/tenants/{tenant}/pjsip.conf", get(pjsip_conf))
        .route("/v1/tenants/{tenant}/routr.json", get(routr_config))
        .with_state(state)
}

/// Routr (open-source SIP) resource set for a tenant, rendered from the SIP
/// resource model — feed to Routr via its SDK/CLI or files connector.
async fn routr_config(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(tenant): Path<String>,
) -> EngineResult<Json<Value>> {
    require_token(&state, &headers)?;
    if tenant.trim().is_empty() {
        return Err(EngineError::BadRequest("tenant is required".to_owned()));
    }
    crate::routr::render_for_tenant(&state.db, &tenant)
        .await
        .map(Json)
        .map_err(EngineError::Other)
}

async fn list_channels(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> EngineResult<Json<Value>> {
    require_token(&state, &headers)?;
    Ok(Json(state.ari.list_channels().await?))
}

async fn hold(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> EngineResult<Json<Value>> {
    require_token(&state, &headers)?;
    state.ari.hold(&id).await?;
    Ok(Json(json!({ "held": true })))
}

async fn unhold(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> EngineResult<Json<Value>> {
    require_token(&state, &headers)?;
    state.ari.unhold(&id).await?;
    Ok(Json(json!({ "held": false })))
}

#[derive(Debug, Deserialize)]
struct DirectionQuery {
    #[serde(default)]
    direction: Option<String>,
}

async fn mute(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Query(q): Query<DirectionQuery>,
) -> EngineResult<Json<Value>> {
    require_token(&state, &headers)?;
    state.ari.mute(&id, q.direction.as_deref().unwrap_or("both")).await?;
    Ok(Json(json!({ "muted": true })))
}

async fn unmute(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Query(q): Query<DirectionQuery>,
) -> EngineResult<Json<Value>> {
    require_token(&state, &headers)?;
    state.ari.unmute(&id, q.direction.as_deref().unwrap_or("both")).await?;
    Ok(Json(json!({ "muted": false })))
}

#[derive(Debug, Deserialize)]
struct TransferReq {
    endpoint: String,
}

async fn transfer(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(req): Json<TransferReq>,
) -> EngineResult<Json<Value>> {
    require_token(&state, &headers)?;
    let ep = if req.endpoint.contains('/') {
        req.endpoint.clone()
    } else {
        format!("PJSIP/{}", req.endpoint.trim())
    };
    state.ari.redirect(&id, &ep).await?;
    Ok(Json(json!({ "transferred": true })))
}

#[derive(Debug, Deserialize)]
struct SnoopReq {
    /// "monitor" (listen) | "whisper" (talk to agent) | "barge" (talk to both).
    #[serde(default)]
    mode: Option<String>,
}

async fn snoop(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(req): Json<SnoopReq>,
) -> EngineResult<Json<Value>> {
    require_token(&state, &headers)?;
    let (spy, whisper) = match req.mode.as_deref().unwrap_or("monitor") {
        "barge" => ("both", "both"),
        "whisper" => ("both", "out"),
        _ => ("both", "none"),
    };
    let res = state.ari.snoop(&id, spy, whisper).await?;
    Ok(Json(res))
}

#[derive(Debug, Deserialize)]
struct RecordReq {
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    max_seconds: Option<u32>,
}

async fn record_channel(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(req): Json<RecordReq>,
) -> EngineResult<Json<Value>> {
    require_token(&state, &headers)?;
    let name = req.name.unwrap_or_else(|| format!("sabcall-{id}"));
    let res = state
        .ari
        .record(&id, &name, "wav", req.max_seconds.unwrap_or(3600))
        .await?;
    Ok(Json(res))
}

async fn health(State(state): State<AppState>) -> Json<Value> {
    Json(json!({
        "status": "ok",
        "enabled": state.cfg.enabled,
        "app": state.cfg.ari_app,
    }))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OriginateReq {
    /// Tenant (SabCall project id) the call belongs to.
    tenant: String,
    /// Destination: an E.164/number (routed `PJSIP/<n>`) or a full ARI endpoint
    /// like `PJSIP/trunk_acme/+1555…`.
    to: String,
    #[serde(default)]
    caller_id: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct OriginateResp {
    channel_id: String,
}

async fn originate(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<OriginateReq>,
) -> EngineResult<Json<OriginateResp>> {
    require_token(&state, &headers)?;
    if !state.cfg.enabled {
        return Err(EngineError::BadRequest("engine disabled".to_owned()));
    }
    let tenant = req.tenant.trim().to_owned();
    if tenant.is_empty() {
        return Err(EngineError::BadRequest("`tenant` is required".to_owned()));
    }
    if req.to.trim().is_empty() {
        return Err(EngineError::BadRequest("`to` is required".to_owned()));
    }
    let endpoint = if req.to.contains('/') {
        req.to.clone()
    } else {
        format!("PJSIP/{}", req.to.trim())
    };

    let out = state
        .ari
        .originate(&endpoint, req.caller_id.as_deref(), "outbound")
        .await?;
    let channel_id = out
        .get("id")
        .and_then(Value::as_str)
        .map(str::to_owned)
        .ok_or_else(|| EngineError::Ari("originate returned no channel id".to_owned()))?;

    cdr::write(
        &state.db,
        CdrInput {
            tenant,
            from_number: req.caller_id.unwrap_or_default(),
            to_number: req.to,
            direction: "outbound",
            status: "completed".to_owned(),
            duration_secs: 0,
            did_id: None,
            provider_call_sid: Some(channel_id.clone()),
        },
    )
    .await;

    Ok(Json(OriginateResp { channel_id }))
}

async fn hangup(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(channel_id): Path<String>,
) -> EngineResult<Json<Value>> {
    require_token(&state, &headers)?;
    state.ari.hangup(&channel_id).await?;
    Ok(Json(json!({ "hungUp": true })))
}

async fn pjsip_conf(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(tenant): Path<String>,
) -> EngineResult<String> {
    require_token(&state, &headers)?;
    if tenant.trim().is_empty() {
        return Err(EngineError::BadRequest("tenant is required".to_owned()));
    }
    pjsip::render_for_tenant(&state.db, &tenant)
        .await
        .map_err(EngineError::Other)
}
