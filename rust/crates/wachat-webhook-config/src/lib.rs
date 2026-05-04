//! # wachat-webhook-config
//!
//! Admin HTTP surface for inspecting and managing the wachat webhook log
//! collection. This is the Rust port of the four server actions in
//! `src/app/actions/webhook.actions.ts`:
//!
//! 1. `getWebhookLogs(projectId, page, limit, query)` — paginated list.
//! 2. `getWebhookLogPayload(logId)`                  — raw payload fetch.
//! 3. `handleReprocessWebhook(logId)`                — replay through the
//!    processor pipeline. **In this slice** we only mark the log as
//!    `pending_reprocess` and leave the actual replay to a follow-up that
//!    can call into the receiver's dispatcher.
//! 4. `handleClearProcessedLogs()`                   — bulk-delete logs that
//!    have already been processed.
//!
//! ## State contract
//!
//! [`router`] is generic over the caller's app-state type `S`. The handlers
//! need only a Mongo handle (storage) and the JWT verifier config (auth);
//! both are pulled out via [`FromRef`] so this crate never has to know about
//! the outer state struct.
//!
//! ## Mount path
//!
//! Routes are mounted under `/admin/...`; the caller (`api` crate) nests
//! this router under `/v1/wachat/webhook/`, giving the final URLs:
//!
//! * `GET  /v1/wachat/webhook/admin/logs`
//! * `GET  /v1/wachat/webhook/admin/logs/{id}/payload`
//! * `POST /v1/wachat/webhook/admin/logs/{id}/reprocess`
//! * `POST /v1/wachat/webhook/admin/logs/clear`
//!
//! ## Auth
//!
//! Every endpoint requires the [`AuthUser`] extractor — there is no
//! anonymous access. The clear/reprocess endpoints additionally require
//! `admin` or `owner` in `roles` via [`auth_check::ensure_admin`].
//!
//! [`AuthUser`]: sabnode_auth::AuthUser

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

pub mod auth_check;
pub mod dto;
pub mod handlers;

pub use dto::{ClearResp, ListLogsQuery, ListLogsResp, ReprocessResp, WebhookLogSummary};

/// Mongo collection name for captured webhook deliveries. Mirrors
/// `db.collection('webhook_logs')` on the TypeScript side.
pub const WEBHOOK_LOGS_COLLECTION: &str = "webhook_logs";

/// Hard cap on the `limit` query parameter, defended in the handler so it is
/// also enforced against direct callers (not just the TS client).
pub const MAX_LIST_LIMIT: i64 = 100;

/// Default page size when the caller omits `limit`.
pub const DEFAULT_LIST_LIMIT: i64 = 50;

/// Build the wachat webhook admin router.
///
/// Mounted under `/admin/...` — the caller is expected to nest the result
/// under `/v1/wachat/webhook/` so the final URLs land at
/// `/v1/wachat/webhook/admin/...`.
///
/// `S` is the caller's outer application state. The handlers need only a
/// Mongo handle and the JWT verifier config; both are pulled out via
/// [`FromRef`] so this crate stays decoupled from a single monolithic state
/// struct.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/admin/logs", get(handlers::list_logs))
        .route("/admin/logs/{id}/payload", get(handlers::get_payload))
        .route("/admin/logs/{id}/reprocess", post(handlers::reprocess))
        .route("/admin/logs/clear", post(handlers::clear_processed))
}
