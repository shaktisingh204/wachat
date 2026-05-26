//! Mountable router for the SabBigin config endpoints.
//!
//! Mount under `/v1/sabbigin/config` from the host `api` crate:
//!
//! ```ignore
//! use sabbigin_config;
//! .nest("/v1/sabbigin/config", sabbigin_config::router::<AppState>())
//! ```
//!
//! Routes (relative — caller nests under `/v1/sabbigin/config`):
//!
//! ```text
//! GET    /        — list_configs
//! POST   /        — create_config
//! GET    /current — get_current_config
//! GET    /{id}    — get_config
//! PATCH  /{id}    — update_config
//! DELETE /{id}    — delete_config (soft → status: archived)
//! ```

use std::sync::Arc;

use axum::{Router, extract::FromRef, routing::get};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

use crate::handlers;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route(
            "/",
            get(handlers::list_configs).post(handlers::create_config),
        )
        .route("/current", get(handlers::get_current_config))
        .route(
            "/{configId}",
            get(handlers::get_config)
                .patch(handlers::update_config)
                .delete(handlers::delete_config),
        )
}
