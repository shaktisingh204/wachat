//! `/audit` — read-only access to the `sabwa_audit_log` collection.
//!
//! Mounted at `GET /v1/audit`. All writes happen implicitly from the mutating
//! routes via [`crate::audit::record`].

use axum::{
    extract::{Query, State},
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};

use crate::audit::{self, AuditEntry, AuditFilter};
use crate::error::AppError;
use crate::state::AppState;

/// Build the `/audit` sub-router.
pub fn router() -> Router<AppState> {
    Router::new().route("/", get(list_audit))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListAuditQuery {
    #[serde(default)]
    pub session_id: Option<String>,
    #[serde(default)]
    pub from: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(default)]
    pub to: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(default)]
    pub action_prefix: Option<String>,
    #[serde(default)]
    pub limit: Option<u32>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListAuditResponse {
    pub entries: Vec<AuditEntry>,
}

async fn list_audit(
    State(state): State<AppState>,
    Query(q): Query<ListAuditQuery>,
) -> Result<Json<ListAuditResponse>, AppError> {
    tracing::info!(
        session_id = ?q.session_id,
        action_prefix = ?q.action_prefix,
        "audit: list"
    );

    let filter = AuditFilter {
        session_id: q.session_id,
        from: q.from,
        to: q.to,
        action_prefix: q.action_prefix,
        limit: q.limit,
    };
    let entries = audit::list(&state, filter)
        .await
        .map_err(AppError::Internal)?;
    Ok(Json(ListAuditResponse { entries }))
}
