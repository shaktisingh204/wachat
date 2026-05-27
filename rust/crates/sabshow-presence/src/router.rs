//! Mountable router for `/v1/sabshow/presence/*`.

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{delete, get, post},
};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

use crate::handlers;

/// ```text
/// GET    /              — list_presence (?deckId=…)
/// POST   /heartbeat     — heartbeat
/// DELETE /              — disconnect (?deckId=…)
/// ```
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route(
            "/",
            get(handlers::list_presence).delete(handlers::disconnect),
        )
        .route("/heartbeat", post(handlers::heartbeat))
        // Older Axum bound `delete` directly; keep an explicit alias.
        .route("/disconnect", delete(handlers::disconnect))
}
