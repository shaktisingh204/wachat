//! HTTP surface. `/health` is public; everything under `/v1/*` requires
//! `X-Sabmail-Service-Token`. The Next.js engine-client
//! (`src/lib/sabmail/engine-client.ts`) is the only caller.

use std::sync::Arc;

use axum::{
    extract::State,
    middleware,
    routing::{get, post},
    Json, Router,
};
use serde_json::{json, Value};

use crate::{auth, errors::EngineResult, inbound, journeys, send, state::AppState};

pub fn router(state: Arc<AppState>) -> Router {
    let service = Router::new()
        .route("/v1/send", post(send_handler))
        .route("/v1/journeys/tick", post(journeys_tick_handler))
        .route("/v1/inbound", post(inbound_handler))
        .route("/v1/accounts/sync", post(accounts_sync))
        .route("/v1/internal/creds/invalidate", post(invalidate_creds))
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth::require_service_token,
        ));

    Router::new()
        .route("/health", get(health))
        .merge(service)
        .with_state(state)
}

async fn health() -> Json<Value> {
    Json(json!({ "ok": true, "service": "sabmail-engine" }))
}

async fn send_handler(
    State(state): State<Arc<AppState>>,
    Json(req): Json<send::SendRequest>,
) -> EngineResult<Json<Value>> {
    let message_id = send::send_message(&state, req).await?;
    Ok(Json(json!({ "ok": true, "messageId": message_id })))
}

async fn journeys_tick_handler(
    State(state): State<Arc<AppState>>,
) -> EngineResult<Json<journeys::TickResult>> {
    let result = journeys::tick(&state).await?;
    Ok(Json(result))
}

async fn inbound_handler(
    State(state): State<Arc<AppState>>,
    Json(req): Json<inbound::InboundRequest>,
) -> EngineResult<Json<inbound::InboundResult>> {
    let result = inbound::process_inbound(&state, req).await?;
    Ok(Json(result))
}

/// Parity endpoint for `engineClient.requestSync()`
/// (`src/lib/sabmail/engine-client.ts`). This engine does NOT own IMAP sync —
/// that is the job of the `sabmail-sync` PM2 worker, which polls connected
/// accounts on its own schedule. The engine only sends (lettre) and ticks
/// journeys, so there is nothing to enqueue here. We return an accepted
/// no-op ack (`queued: false`) so the client contract matches and the call no
/// longer 404s/swallows; the sync worker remains the source of truth.
async fn accounts_sync() -> Json<Value> {
    Json(json!({ "ok": true, "queued": false }))
}

/// Parity endpoint — this engine holds no per-request credential cache
/// (creds are decrypted on demand), so invalidation is a no-op ack.
async fn invalidate_creds() -> Json<Value> {
    Json(json!({ "ok": true }))
}
