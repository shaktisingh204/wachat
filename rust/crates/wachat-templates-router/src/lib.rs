//! # wachat-templates-router
//!
//! Phase 3 slice 6 of the SabNode wachat → Rust port. This crate owns the
//! axum router that mounts every template endpoint under
//! `/v1/wachat/templates`. It contains **no business logic** — every
//! handler delegates to one of the engine crates from slices 1–5:
//!
//! | Engine                                   | Slice |
//! | ---------------------------------------- | ----- |
//! | [`wachat_templates::TemplatesReader`]    | 1     |
//! | [`wachat_templates_mutate::TemplatesMutator`] | 2 |
//! | [`wachat_templates_sync::TemplatesSyncer`]    | 3 |
//! | [`wachat_templates_categories::TemplatesLibrary`] | 4 |
//! | [`wachat_templates_send::TemplateSender`] | 5    |
//!
//! ## Mount path
//!
//! Routes are written **relative** (`/`, `/{id}`, `/library`, …). The
//! caller (the `api` crate) is expected to nest the result under
//! `/v1/wachat/templates`, giving final URLs like
//! `/v1/wachat/templates/{id}/send`.
//!
//! ## State contract
//!
//! [`router`] is generic over the caller's outer state `S`. The handlers
//! need only:
//!
//! - a [`TemplatesState`] bundle (engine handles + `MongoHandle`), and
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
//! project. The follow-up `sabnode-tenancy` slice will swap that for a
//! membership lookup against `project_members`.

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{delete, get, post},
};
use sabnode_auth::AuthConfig;

pub mod dto;
pub mod handlers;
pub mod state;

pub use state::TemplatesState;

/// Build the wachat templates router.
///
/// Routes (mounted relative — caller nests under
/// `/v1/wachat/templates`):
///
/// ```text
/// GET    /                       — list templates                 (?project_id)
/// GET    /{id}                   — get one template               (?project_id)
/// POST   /                       — create
/// POST   /bulk                   — bulk create
/// POST   /flow                   — create flow-button template
/// POST   /sync                   — sync from Meta                 ({project_id})
/// POST   /{id}/edit              — edit
/// DELETE /{id}                   — delete by id                   (?project_id)
/// DELETE /by-name                — delete by name                 (?project_id&name)
/// POST   /{id}/send              — send template message
/// GET    /library                — list shared library
/// POST   /library                — save into library              (admin)
/// DELETE /library/{id}           — delete from library            (admin)
/// POST   /library/{id}/apply     — copy library template to N projects
/// ```
///
/// `S` is the caller's outer application state. The handlers need a
/// [`TemplatesState`] bundle and the JWT verifier config; both are
/// pulled via [`FromRef`] so the router does not have to know about a
/// concrete monolithic state struct.
///
/// **Important**: `DELETE /by-name` is registered **before**
/// `DELETE /{id}` so axum's matcher prefers the literal segment over
/// the `{id}` parameter.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    TemplatesState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        // ---- root list / create -----------------------------------
        .route("/", get(handlers::list).post(handlers::create))
        // ---- bulk / flow / sync (literal segments — register before /{id}) -
        .route("/bulk", post(handlers::bulk_create))
        .route("/flow", post(handlers::create_flow))
        .route("/sync", post(handlers::sync))
        .route("/by-name", delete(handlers::delete_by_name))
        // ---- library --------------------------------------------------
        // Library routes go BEFORE the catch-all `/{id}` patterns so
        // `library` is treated as a literal segment, not a template id.
        .route(
            "/library",
            get(handlers::list_library).post(handlers::save_library),
        )
        .route("/library/{id}", delete(handlers::delete_library))
        .route("/library/{id}/apply", post(handlers::apply_library))
        // ---- per-template by-id ---------------------------------------
        .route(
            "/{id}",
            get(handlers::get_by_id).delete(handlers::delete_by_id),
        )
        .route("/{id}/edit", post(handlers::edit))
        .route("/{id}/send", post(handlers::send))
}
