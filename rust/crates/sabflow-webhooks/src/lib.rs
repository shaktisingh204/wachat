//! # sabflow-webhooks
//!
//! Inbound webhook trigger handler for SabFlow.
//!
//! Registers webhook slugs when flows are activated and enqueues executions
//! when inbound HTTP calls arrive at `GET/POST /v1/sabflow/webhook/:webhookId`.
//!
//! Mount under `/v1/sabflow/webhook` from the `api` crate:
//!
//! ```ignore
//! .nest("/v1/sabflow/webhook", sabflow_webhooks::router::<AppState>())
//! ```
//!
//! Phase 6 implements the full webhook registry and response modes.
//! This stub compiles and responds with 501 Not Implemented.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod state;

use std::sync::Arc;

use axum::extract::FromRef;
use sabnode_auth::AuthConfig;

pub use state::SabflowWebhooksState;

pub fn router<S>() -> axum::Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabflowWebhooksState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    router::router::<S>()
}
