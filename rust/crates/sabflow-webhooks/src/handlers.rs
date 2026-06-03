use axum::{
    Json,
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
};
use std::collections::HashMap;

use crate::{
    dto::{RegisterWebhookRequest, WebhookTriggerResponse},
    queue::{WebhookExecutionPayload, enqueue_webhook_execution},
    state::SabflowWebhooksState,
    store::WebhookStore,
};

// ── Auth helpers ────────────────────────────────────────────────────────────

fn check_auth(
    headers: &HeaderMap,
    query: &HashMap<String, String>,
    authentication: &str,
    auth_header_name: Option<&str>,
    auth_header_value: Option<&str>,
) -> bool {
    match authentication {
        "none" => true,
        "header" => {
            let name = auth_header_name.unwrap_or("authorization").to_lowercase();
            let expected = auth_header_value.unwrap_or("");
            headers
                .get(&name)
                .and_then(|v| v.to_str().ok())
                .map(|v| v == expected)
                .unwrap_or(false)
        }
        "query" => {
            let expected = auth_header_value.unwrap_or("");
            query
                .get("token")
                .map(|t| t.as_str() == expected)
                .unwrap_or(false)
        }
        "basic" => {
            let header = headers
                .get("authorization")
                .and_then(|v| v.to_str().ok())
                .unwrap_or("");
            if !header.starts_with("Basic ") {
                return false;
            }
            let decoded = match base64_decode(&header[6..]) {
                Some(d) => d,
                None => return false,
            };
            let expected = auth_header_value.unwrap_or(":");
            let (user, pass) = decoded.split_once(':').unwrap_or((&decoded, ""));
            let (exp_user, exp_pass) = expected.split_once(':').unwrap_or((expected, ""));
            user == exp_user && pass == exp_pass
        }
        _ => false,
    }
}

fn base64_decode(s: &str) -> Option<String> {
    let bytes = base64_chars_to_bytes(s)?;
    String::from_utf8(bytes).ok()
}

fn base64_chars_to_bytes(s: &str) -> Option<Vec<u8>> {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let s = s.trim_end_matches('=');
    let mut out = Vec::with_capacity(s.len() * 3 / 4);
    let mut acc: u32 = 0;
    let mut bits: u32 = 0;

    for c in s.bytes() {
        let val = TABLE.iter().position(|&b| b == c)? as u32;
        acc = (acc << 6) | val;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push((acc >> bits) as u8);
            acc &= (1 << bits) - 1;
        }
    }
    Some(out)
}

// ── Shared execution logic (owned inputs to satisfy Rust 2024 capture rules) ─

async fn do_trigger(
    state: SabflowWebhooksState,
    webhook_id: String,
    method: String,
    headers: HeaderMap,
    query: HashMap<String, String>,
    body_bytes: axum::body::Bytes,
) -> axum::response::Response {
    let store = WebhookStore::new(state.mongo.clone());

    let webhook = match store.find_by_webhook_id(&webhook_id).await {
        Ok(Some(w)) => w,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({ "error": "Webhook not found" })),
            )
                .into_response();
        }
        Err(e) => {
            tracing::error!(error = %e, "failed to look up webhook");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
                .into_response();
        }
    };

    if !webhook.is_active {
        return (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Webhook is inactive" })),
        )
            .into_response();
    }

    if webhook.method != "ANY" && webhook.method != method {
        return (
            StatusCode::METHOD_NOT_ALLOWED,
            Json(serde_json::json!({ "error": "Method not allowed" })),
        )
            .into_response();
    }

    if !check_auth(
        &headers,
        &query,
        &webhook.authentication,
        webhook.auth_header_name.as_deref(),
        webhook.auth_header_value.as_deref(),
    ) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({ "error": "Unauthorized" })),
        )
            .into_response();
    }

    let trigger_body: Option<serde_json::Value> = if !body_bytes.is_empty() {
        serde_json::from_slice(&body_bytes).ok()
    } else {
        None
    };

    let trigger_data = serde_json::json!({
        "body": trigger_body,
        "query": query,
        "method": method,
    });

    let flow_snapshot = match store
        .fetch_flow_snapshot(&webhook.flow_id, &webhook.user_id)
        .await
    {
        Ok(Some(snap)) => snap,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({ "error": "Flow not found or inactive" })),
            )
                .into_response();
        }
        Err(e) => {
            tracing::error!(error = %e, "failed to fetch flow snapshot");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
                .into_response();
        }
    };

    let execution_id = match store
        .insert_execution(
            &webhook.flow_id,
            &webhook.user_id,
            Some(trigger_data.clone()),
        )
        .await
    {
        Ok(id) => id,
        Err(e) => {
            tracing::error!(error = %e, "failed to insert execution record");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Failed to create execution record" })),
            )
                .into_response();
        }
    };

    let payload = WebhookExecutionPayload {
        execution_id: execution_id.clone(),
        flow_id: webhook.flow_id.clone(),
        project_id: webhook.user_id.clone(),
        flow_snapshot,
        trigger_mode: "webhook".to_string(),
        trigger_data: Some(trigger_data),
        variables: Default::default(),
    };

    if let Err(e) = enqueue_webhook_execution(&state.bull, &payload).await {
        tracing::error!(error = %e, execution_id = %execution_id, "failed to enqueue webhook execution");
    }

    tracing::info!(webhook_id = %webhook_id, execution_id = %execution_id, "webhook triggered");

    (
        StatusCode::OK,
        Json(WebhookTriggerResponse {
            execution_id,
            status: "queued".to_string(),
        }),
    )
        .into_response()
}

// ── Route handlers ──────────────────────────────────────────────────────────

/// GET /v1/sabflow/webhook/:webhookId
pub async fn handle_get(
    State(state): State<SabflowWebhooksState>,
    Path(webhook_id): Path<String>,
    Query(query): Query<HashMap<String, String>>,
    headers: HeaderMap,
) -> axum::response::Response {
    do_trigger(
        state,
        webhook_id,
        "GET".to_string(),
        headers,
        query,
        axum::body::Bytes::new(),
    )
    .await
}

/// POST /v1/sabflow/webhook/:webhookId
pub async fn handle_post(
    State(state): State<SabflowWebhooksState>,
    Path(webhook_id): Path<String>,
    Query(query): Query<HashMap<String, String>>,
    headers: HeaderMap,
    body: axum::body::Bytes,
) -> axum::response::Response {
    do_trigger(state, webhook_id, "POST".to_string(), headers, query, body).await
}

/// POST /v1/sabflow/webhook-admin/register  (auth-guarded — JWT required)
pub async fn register_webhook(
    State(state): State<SabflowWebhooksState>,
    auth: sabnode_auth::AuthUser,
    Json(body): Json<RegisterWebhookRequest>,
) -> impl IntoResponse {
    let store = WebhookStore::new(state.mongo.clone());

    match store
        .upsert_webhook(
            &body.flow_id,
            &auth.tenant_id,
            body.app_event.as_deref().unwrap_or("webhook_received"),
            body.method.as_deref().unwrap_or("ANY"),
            body.authentication.as_deref().unwrap_or("none"),
            body.response_mode.as_deref().unwrap_or("immediately"),
        )
        .await
    {
        Ok(reg) => Json(reg).into_response(),
        Err(e) => {
            tracing::error!(error = %e, "failed to register webhook");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Failed to register webhook" })),
            )
                .into_response()
        }
    }
}

/// POST /v1/sabflow/webhook-admin/deactivate/:flowId  (auth-guarded)
pub async fn deactivate_webhooks(
    State(state): State<SabflowWebhooksState>,
    auth: sabnode_auth::AuthUser,
    Path(flow_id): Path<String>,
) -> impl IntoResponse {
    let store = WebhookStore::new(state.mongo.clone());

    match store
        .deactivate_flow_webhooks(&flow_id, &auth.tenant_id)
        .await
    {
        Ok(()) => Json(serde_json::json!({ "ok": true })).into_response(),
        Err(e) => {
            tracing::error!(error = %e, "failed to deactivate webhooks");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Failed to deactivate webhooks" })),
            )
                .into_response()
        }
    }
}
