use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};

use crate::state::SabflowWebhooksState;

/// GET /v1/sabflow/webhook/:webhookId — Phase 6 implements the full handler.
pub async fn handle_get(
    State(_state): State<SabflowWebhooksState>,
    Path(webhook_id): Path<String>,
) -> impl IntoResponse {
    tracing::info!(webhook_id = %webhook_id, "webhook GET received (Phase 6 pending)");
    (
        StatusCode::NOT_IMPLEMENTED,
        Json(serde_json::json!({ "error": "Webhook trigger support coming in Phase 6" })),
    )
}

/// POST /v1/sabflow/webhook/:webhookId — Phase 6 implements the full handler.
pub async fn handle_post(
    State(_state): State<SabflowWebhooksState>,
    Path(webhook_id): Path<String>,
    body: axum::body::Bytes,
) -> impl IntoResponse {
    tracing::info!(
        webhook_id = %webhook_id,
        body_len = body.len(),
        "webhook POST received (Phase 6 pending)"
    );
    (
        StatusCode::NOT_IMPLEMENTED,
        Json(serde_json::json!({ "error": "Webhook trigger support coming in Phase 6" })),
    )
}
