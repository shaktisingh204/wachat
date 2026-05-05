//! # wachat-webhook-actions
//!
//! Thin HTTP shim that mirrors the four user-facing webhook server actions
//! from `src/app/actions/webhook.actions.ts`:
//!
//! 1. `getWebhookLogs(projectId, page, limit, query)` — paginated list.
//! 2. `getWebhookLogPayload(logId)`                  — raw payload fetch.
//! 3. `handleReprocessWebhook(logId)`                — mark for replay.
//! 4. `handleClearProcessedLogs()`                   — bulk-delete processed.
//!
//! ## Why a separate crate?
//!
//! `wachat-webhook-config` already implements the same four operations as
//! the **admin** surface mounted under `/v1/wachat/webhook/admin/...`.
//! This crate is the **user-facing** mount under
//! `/v1/wachat/webhook-actions/...` so the Next.js server actions have a
//! stable namespace separate from the admin tooling. The actual handlers
//! and DTOs are reused from `wachat-webhook-config` — there is no logic
//! duplication.
//!
//! ## State contract
//!
//! [`router`] is generic over the caller's app-state type `S`. Handlers
//! pull a [`MongoHandle`](sabnode_db::mongo::MongoHandle) and an
//! `Arc<AuthConfig>` out of `S` via [`FromRef`](axum::extract::FromRef);
//! this crate never has to know the outer state struct.
//!
//! ## Mount path
//!
//! Routes register at the relative paths below; the `api` crate nests the
//! whole router under `/v1/wachat/webhook-actions`:
//!
//! * `GET  /v1/wachat/webhook-actions/logs`
//! * `GET  /v1/wachat/webhook-actions/logs/{id}/payload`
//! * `POST /v1/wachat/webhook-actions/logs/{id}/reprocess`
//! * `POST /v1/wachat/webhook-actions/logs/clear`
//!
//! ## Auth
//!
//! Every endpoint requires the [`AuthUser`](sabnode_auth::AuthUser)
//! extractor; the underlying `wachat-webhook-config` handlers also enforce
//! the `admin`/`owner` role check via `auth_check::ensure_admin`.

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

pub mod state;

pub use state::WachatWebhookActionsState;

// Re-export DTOs so downstream callers can refer to them through this
// crate's namespace and the underlying implementation crate stays an
// internal detail.
pub use wachat_webhook_config::{
    ClearResp, ListLogsQuery, ListLogsResp, ReprocessResp, WebhookLogSummary,
};

/// Build the wachat webhook-actions router.
///
/// Mounted under relative paths; the caller (`api` crate) nests this
/// router under `/v1/wachat/webhook-actions` to land the URLs documented
/// at the crate level.
///
/// `S` is the caller's outer application state; the inner handlers need
/// only `MongoHandle` and `Arc<AuthConfig>`, both pulled via `FromRef`.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    WachatWebhookActionsState: FromRef<S>,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    // The handlers in `wachat_webhook_config::handlers` extract
    // `State<MongoHandle>` directly, so we wire them straight in. The
    // `WachatWebhookActionsState` requirement above ensures the outer
    // app state declares this crate's slice; today it's just a typed
    // marker so future per-action state (rate limits, feature flags)
    // lands without rewiring callers.
    Router::new()
        .route("/logs", get(wachat_webhook_config::handlers::list_logs))
        .route(
            "/logs/{id}/payload",
            get(wachat_webhook_config::handlers::get_payload),
        )
        .route(
            "/logs/{id}/reprocess",
            post(wachat_webhook_config::handlers::reprocess),
        )
        .route(
            "/logs/clear",
            post(wachat_webhook_config::handlers::clear_processed),
        )
}
