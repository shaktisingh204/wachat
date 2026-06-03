//! # wachat-broadcast
//!
//! Phase 6 of the SabNode wachat → Rust port. Replaces the
//! `src/app/actions/broadcast.actions.ts` server action file with an
//! HTTP-mounted axum router under `/v1/wachat/broadcast`.
//!
//! ## Scope
//!
//! This crate is the API layer. It owns the **wire shapes** and the
//! **request orchestration** (auth + tenancy guard, Mongo read / write,
//! BullMQ enqueue) but no Meta-side I/O — that belongs to phases that
//! port the actual broadcast worker (control + send) and the media
//! upload path.
//!
//! Concretely the TS file did three things; we keep all three behind
//! the new HTTP surface:
//!
//!   * **Mongo reads** — list / get / attempts / attempts-export / logs.
//!   * **Mongo writes** — insert broadcasts + broadcast_contacts;
//!     update broadcast status (`Cancelled`).
//!   * **BullMQ enqueue** — push a `process-broadcast` job onto the
//!     `broadcast-control` queue using the existing `wachat-queue`
//!     producer so the legacy Node worker keeps consuming as-is.
//!
//! ## What we deliberately offload to the TS shim
//!
//! The TS server action took multipart `FormData` carrying CSV files
//! and header media. JSON-over-HTTP is not the right transport for
//! that, and the existing TS code already knows how to:
//!
//!   * Parse CSV / XLSX into the per-contact records the worker reads
//!     out of `broadcast_contacts`.
//!   * Upload header / carousel media to Meta and resolve the resulting
//!     Meta media id.
//!
//! So the migration leaves those two steps in the TS shim and accepts
//! a normalized JSON payload here. Rust then validates, writes Mongo,
//! and enqueues. This matches the "thin TS shim" contract because every
//! piece of business logic that is **not** transport-specific (auth,
//! tenancy, validation, persistence, queue) lives in Rust.
//!
//! ## Mount path
//!
//! Routes are written **relative**. The caller (the `api` crate) nests
//! the result under `/v1/wachat/broadcast`, giving final URLs like
//! `/v1/wachat/broadcast/projects/{id}/list`.
//!
//! ## State contract
//!
//! [`router`] is generic over the caller's outer state `S`. The
//! handlers need only:
//!
//! - a [`WachatBroadcastState`] bundle (Mongo handle + BullMQ producer),
//!   and
//! - an `Arc<sabnode_auth::AuthConfig>` (the JWT verifier the
//!   [`AuthUser`](sabnode_auth::AuthUser) extractor reads).
//!
//! Both are pulled out via [`FromRef`](axum::extract::FromRef) so this
//! crate stays decoupled from the orchestrator's `AppState` struct.
//!
//! ## Auth
//!
//! Every endpoint requires the [`AuthUser`](sabnode_auth::AuthUser)
//! extractor — there is no anonymous access. Per-project endpoints
//! additionally enforce
//! `user.tenant_id == project.userId.to_hex()` after loading the
//! project. The cross-tenant **admin** list endpoint additionally
//! requires the `"admin"` role on the JWT.

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
use sabnode_auth::AuthConfig;

pub mod dto;
pub mod handlers;
pub mod state;

pub use state::WachatBroadcastState;

/// Build the wachat broadcast router.
///
/// Routes (mounted relative — caller nests under
/// `/v1/wachat/broadcast`):
///
/// ```text
/// GET    /admin/list                                    — cross-tenant list (admin)
/// GET    /projects/{project_id}/list                    — list for one project
/// GET    /{broadcast_id}                                — get broadcast by id
/// GET    /{broadcast_id}/attempts                       — paginated attempts
/// GET    /{broadcast_id}/attempts/export                — flat attempts list (export)
/// GET    /{broadcast_id}/logs                           — recent log lines
///
/// POST   /start                                         — handleStartBroadcast
/// POST   /bulk-start                                    — handleBulkBroadcast
/// POST   /api-start                                     — handleStartApiBroadcast
/// POST   /{broadcast_id}/requeue                        — handleRequeueBroadcast
/// POST   /{broadcast_id}/stop                           — handleStopBroadcast
/// ```
///
/// `S` is the caller's outer application state. The handlers need a
/// [`WachatBroadcastState`] bundle and the JWT verifier config; both are
/// pulled via [`FromRef`] so the router does not have to know about a
/// concrete monolithic state struct.
///
/// **Route ordering note:** the literal segment routes
/// (`/admin/list`, `/start`, `/bulk-start`, `/api-start`) are registered
/// before the `/{broadcast_id}/...` patterns so axum's matcher prefers
/// the literal segment over the `{id}` parameter.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    WachatBroadcastState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        // ---- literal segments (must precede /{broadcast_id}) ----------
        .route("/admin/list", get(handlers::admin_list))
        .route("/admin/requeue-stuck", post(handlers::requeue_stuck))
        .route("/start", post(handlers::start))
        .route("/bulk-start", post(handlers::bulk_start))
        .route("/api-start", post(handlers::api_start))
        .route(
            "/projects/{project_id}/list",
            get(handlers::list_for_project),
        )
        // Multipart upload: replaces the legacy `uploadMediaToMeta`
        // axios call from `broadcast.actions.ts`. Forwards the binary
        // body to Meta via `wachat-media::MediaUploader`.
        .route("/projects/{project_id}/media", post(handlers::upload_media))
        // ---- per-broadcast endpoints ----------------------------------
        .route("/{broadcast_id}", get(handlers::get_by_id))
        .route("/{broadcast_id}/attempts", get(handlers::list_attempts))
        .route(
            "/{broadcast_id}/attempts/export",
            get(handlers::export_attempts),
        )
        .route("/{broadcast_id}/logs", get(handlers::list_logs))
        .route("/{broadcast_id}/requeue", post(handlers::requeue))
        .route("/{broadcast_id}/stop", post(handlers::stop))
}
