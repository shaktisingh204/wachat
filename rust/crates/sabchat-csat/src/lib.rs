//! # sabchat-csat
//!
//! Phase — axum router for the SabChat **CSAT / NPS / CES** surface.
//! Owns the survey-definition CRUD, the agent-triggered send-survey
//! action (which appends a [`ContentBlock::Form`] outbound bot message
//! to a conversation), the public widget-side response submission, and
//! the per-survey stats aggregation.
//!
//! Mounted under **two** prefixes from the orchestrating `api` crate:
//!
//! ```ignore
//! .nest("/v1/sabchat/csat",        sabchat_csat::router::<AppState>())
//! .nest("/v1/sabchat/csat-public", sabchat_csat::public_router::<AppState>())
//! ```
//!
//! ## Why two routers
//!
//! The agent-side surface is fully authenticated and scoped by
//! `tenant_id`. The public surface — used by the embedded widget when a
//! visitor submits the score form — is anonymous (no `AuthUser`); it
//! recovers the tenant via the visitor-token row in
//! `sabchat_widget_sessions`. Keeping them in separate routers means
//! the JWT-extractor middleware doesn't have to know which routes are
//! exempt.
//!
//! ## Routes — agent side (`/v1/sabchat/csat`)
//!
//! | Method | Path                                | Handler            |
//! |--------|-------------------------------------|--------------------|
//! | POST   | `/surveys`                          | `create_survey`    |
//! | GET    | `/surveys`                          | `list_surveys`     |
//! | GET    | `/surveys/{id}`                     | `get_survey`       |
//! | PATCH  | `/surveys/{id}`                     | `update_survey`    |
//! | DELETE | `/surveys/{id}`                     | `delete_survey`    |
//! | POST   | `/send/{conversationId}`            | `send_survey`      |
//! | GET    | `/responses`                        | `list_responses`   |
//! | GET    | `/stats`                            | `survey_stats`     |
//!
//! ## Routes — public widget (`/v1/sabchat/csat-public`)
//!
//! | Method | Path        | Handler              |
//! |--------|-------------|----------------------|
//! | POST   | `/respond`  | `public_respond`     |
//!
//! ## Tenancy
//!
//! Every agent-side handler scopes its Mongo I/O by
//! `tenantId == ObjectId(auth.tenant_id)`. The public handler resolves
//! the tenant from the widget-session row keyed by the visitor token —
//! the request body never carries a tenant id.
//!
//! ## Collections
//!
//! - `sabchat_surveys` — survey definitions.
//! - `sabchat_survey_responses` — one row per visitor submission.
//! - `sabchat_widget_sessions` — read-only here, owned by `sabchat-widget`.
//! - `sabchat_conversations` — updated to stash `customAttrs.csat` /
//!   `customAttrs.pendingSurveyId`.
//! - `sabchat_messages` — appended-to on send (the outbound `Form` block).
//!
//! ## State contract
//!
//! Both [`router`] and [`public_router`] are generic over the caller's
//! outer state `S`. The handlers need:
//!
//! - a [`SabChatCsatState`] bundle (just a Mongo handle today), and
//! - an `Arc<sabnode_auth::AuthConfig>` (only the agent router consumes
//!   `AuthUser` — the public router does not need it).

pub mod dto;
pub mod handlers;
pub mod public_handlers;
pub mod state;

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
use sabnode_auth::AuthConfig;

pub use state::SabChatCsatState;

/// Build the agent-side SabChat CSAT router.
///
/// Routes (mounted relative — caller nests under `/v1/sabchat/csat`):
///
/// ```text
/// POST   /surveys                        — create_survey
/// GET    /surveys                        — list_surveys
/// GET    /surveys/{id}                   — get_survey
/// PATCH  /surveys/{id}                   — update_survey
/// DELETE /surveys/{id}                   — delete_survey
/// POST   /send/{conversationId}          — send_survey
/// GET    /responses                      — list_responses
/// GET    /stats                          — survey_stats
/// ```
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabChatCsatState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        // ---- survey CRUD ---------------------------------------------
        .route(
            "/surveys",
            post(handlers::create_survey).get(handlers::list_surveys),
        )
        .route(
            "/surveys/{id}",
            get(handlers::get_survey)
                .patch(handlers::update_survey)
                .delete(handlers::delete_survey),
        )
        // ---- agent-triggered send ------------------------------------
        .route("/send/{conversation_id}", post(handlers::send_survey))
        // ---- read surfaces -------------------------------------------
        .route("/responses", get(handlers::list_responses))
        .route("/stats", get(handlers::survey_stats))
}

/// Build the **public-widget** SabChat CSAT router.
///
/// Mounted at `/v1/sabchat/csat-public`. No [`AuthUser`] is consumed by
/// any handler in this router — visitor identity is proven by the
/// opaque `visitorToken` body field, looked up against the
/// `sabchat_widget_sessions` collection.
///
/// Routes (mounted relative):
///
/// ```text
/// POST   /respond                        — public_respond
/// ```
pub fn public_router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabChatCsatState: FromRef<S>,
{
    Router::new().route("/respond", post(public_handlers::public_respond))
}
