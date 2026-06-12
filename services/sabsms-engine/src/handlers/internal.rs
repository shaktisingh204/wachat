//! Service-token-protected internal endpoints (called by the Next.js
//! side, never by browsers or carriers).

use std::sync::Arc;

use axum::{extract::State, Json};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::{creds, errors::EngineResult, state::AppState};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InvalidateCredsBody {
    pub workspace_id: String,
}

/// POST /v1/internal/creds/invalidate — drop every cached credential
/// entry for a workspace (the TS side calls this after editing a
/// provider account).
pub async fn invalidate_creds(
    State(state): State<Arc<AppState>>,
    Json(body): Json<InvalidateCredsBody>,
) -> EngineResult<Json<Value>> {
    creds::invalidate_workspace(&state, &body.workspace_id).await;
    Ok(Json(json!({ "ok": true })))
}
