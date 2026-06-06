//! # wachat_ai_training
//!
//! Axum router for the `/wachat/automation` page: per-number automation
//! **model** selection (`meta-native` / `sabnode-ai`) and question/answer
//! **training samples**. Mounted under `/v1/wachat/ai-training`:
//!
//! ```ignore
//! .nest("/v1/wachat/ai-training", wachat_ai_training::router::<AppState>())
//! ```
//!
//! Everything is scoped to the authenticated user plus the
//! `{projectId, phoneNumberId}` path pair. Generic over the caller's state
//! `S`; needs a [`WachatAiTrainingState`] and the JWT verifier config, both
//! pulled via [`FromRef`](axum::extract::FromRef).

pub mod dto;
pub mod handlers;
pub mod state;

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{delete, get},
};
use sabnode_auth::AuthConfig;

pub use state::WachatAiTrainingState;

/// Build the ai-training router (caller nests under `/v1/wachat/ai-training`).
///
/// ```text
/// GET    /model-config/{project_id}/{phone_id}            — get_model_config
/// POST   /model-config/{project_id}/{phone_id}            — upsert_model_config
/// GET    /samples/{project_id}/{phone_id}                 — list_samples
/// POST   /samples/{project_id}/{phone_id}                 — create_sample
/// DELETE /samples/{project_id}/{phone_id}/{sample_id}     — delete_sample
/// ```
///
/// Literal prefixes (`model-config`, `samples`) precede the `/{param}`
/// segments, per axum 0.8 path-ordering rules.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    WachatAiTrainingState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route(
            "/model-config/{project_id}/{phone_id}",
            get(handlers::get_model_config).post(handlers::upsert_model_config),
        )
        .route(
            "/samples/{project_id}/{phone_id}",
            get(handlers::list_samples).post(handlers::create_sample),
        )
        .route(
            "/samples/{project_id}/{phone_id}/{sample_id}",
            delete(handlers::delete_sample),
        )
}
