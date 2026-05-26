//! # sabchat-shifts
//!
//! Phase — axum router that owns the **HRM-aware shift presence** HTTP
//! surface for SabChat. Mounted under `/v1/sabchat/shifts` from the
//! orchestrating `api` crate:
//!
//! ```ignore
//! .nest("/v1/sabchat/shifts", sabchat_shifts::router::<AppState>())
//! ```
//!
//! ## Why a separate crate
//!
//! The sibling `sabchat-teams` crate already owns *manual* presence —
//! "I, the agent, am setting myself to busy". This crate owns the
//! complementary *automated* path: read the HRM module's
//! `crm_attendance` rows, map employees to agents via `crm_employees`,
//! apply tenant-defined `sabchat_shift_rules`, and write the resulting
//! status into `sabchat_agent_presence` with `setBy = "hrm"`.
//!
//! Splitting it keeps the manual / automatic write paths greppable and
//! lets the cron entry-point depend on a single small dependency rather
//! than pulling the whole teams crate into the worker binary.
//!
//! ## Routes
//!
//! | Method  | Path                | Handler          | Notes                                |
//! |---------|---------------------|------------------|--------------------------------------|
//! | `POST`  | `/rules`            | `create_rule`    | Tenant-scoped shift-rule CRUD.       |
//! | `GET`   | `/rules`            | `list_rules`     | Newest first.                        |
//! | `GET`   | `/rules/{id}`       | `get_rule`       | 404 on cross-tenant or missing.      |
//! | `PATCH` | `/rules/{id}`       | `update_rule`    | Partial; empty body → 400.           |
//! | `DELETE`| `/rules/{id}`       | `delete_rule`    | Hard delete.                         |
//! | `POST`  | `/sync`             | `sync`           | Cron-callable; writes presence.      |
//! | `GET`   | `/preview`          | `preview`        | Single-agent dry-run; no writes.     |
//!
//! ## Collections
//!
//! | Direction | Collection                | Owner             |
//! |-----------|---------------------------|-------------------|
//! | r/w       | `sabchat_shift_rules`     | this crate        |
//! | r         | `crm_attendance`          | `crm-attendance`  |
//! | r         | `crm_employees`           | HRM module        |
//! | w         | `sabchat_agent_presence`  | `sabchat-teams`   |
//!
//! ## Auth + tenancy
//!
//! Every endpoint requires the [`AuthUser`](sabnode_auth::AuthUser)
//! extractor; every Mongo read and write filters on the JWT tenant
//! claim. The public [`sync_tenant`] helper bypasses the extractor and
//! is intended for the cron entry-point, which has already authenticated
//! the tenant out-of-band.
//!
//! ## State contract
//!
//! [`router`] is generic over the caller's outer state `S`. The
//! handlers need:
//!
//! - a [`SabChatShiftsState`] bundle (just a Mongo handle today), and
//! - an `Arc<sabnode_auth::AuthConfig>` (the JWT verifier the
//!   [`AuthUser`](sabnode_auth::AuthUser) extractor reads).
//!
//! Both are pulled via [`FromRef`](axum::extract::FromRef) so this crate
//! stays decoupled from the orchestrator's `AppState` struct.

pub mod dto;
pub mod handlers;
pub mod state;

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
use sabnode_auth::AuthConfig;

pub use dto::SyncReport;
pub use state::SabChatShiftsState;

/// Re-export of the public sync helper, intended for the SabChat cron
/// worker which iterates over tenants and calls this without an HTTP
/// round-trip.
pub use handlers::sync_tenant;

/// Build the sabchat shifts router.
///
/// Routes (mounted relative — caller nests under `/v1/sabchat/shifts`):
///
/// ```text
/// POST   /rules                    — create_rule
/// GET    /rules                    — list_rules
/// GET    /rules/{id}               — get_rule
/// PATCH  /rules/{id}               — update_rule
/// DELETE /rules/{id}               — delete_rule
/// POST   /sync                     — sync   (cron-callable)
/// GET    /preview                  — preview (single agent, no writes)
/// ```
///
/// `S` is the caller's outer application state. The handlers need a
/// [`SabChatShiftsState`] bundle and the JWT verifier config; both are
/// pulled via [`FromRef`] so the router does not have to know about a
/// concrete monolithic state struct.
///
/// **Route ordering note:** the literal `/sync` and `/preview` segments
/// are registered before the `/rules/{id}` patterns. They live on a
/// different path segment so axum would not actually collide, but
/// keeping the literal-first convention consistent with sibling routers
/// makes diff review trivial.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabChatShiftsState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        // ---- HRM bridge endpoints (cron + UI preview) ------------------
        .route("/sync", post(handlers::sync))
        .route("/preview", get(handlers::preview))
        // ---- rule CRUD --------------------------------------------------
        .route(
            "/rules",
            post(handlers::create_rule).get(handlers::list_rules),
        )
        .route(
            "/rules/{id}",
            get(handlers::get_rule)
                .patch(handlers::update_rule)
                .delete(handlers::delete_rule),
        )
}
