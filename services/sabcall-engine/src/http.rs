//! HTTP control surface for the Next.js side (originate, hangup, pjsip config).

use axum::{
    extract::{Path, State},
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
        .route("/v1/channels/{channelId}/hangup", post(hangup))
        .route("/v1/tenants/{tenant}/pjsip.conf", get(pjsip_conf))
        .with_state(state)
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
