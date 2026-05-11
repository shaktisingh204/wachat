//! # sabflow-engine
//!
//! Durable SabFlow workflow execution engine. Provides:
//! - BullMQ job enqueueing for flow executions
//! - MongoDB-backed execution records
//! - Axum HTTP API for triggering and querying executions
//! - Flow activation / deactivation
//!
//! Mount under `/v1/sabflow` from the `api` crate:
//!
//! ```ignore
//! .nest("/v1/sabflow", sabflow_engine::router::<AppState>())
//! ```

pub mod dto;
pub mod handlers;
pub mod queue;
pub mod router;
pub mod state;
pub mod store;

use std::sync::Arc;

use axum::extract::FromRef;
use sabnode_auth::AuthConfig;

pub use state::SabflowEngineState;

pub fn router<S>() -> axum::Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabflowEngineState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    router::router::<S>()
}
