//! Mountable router. Mount under `/v1/sabtables/automations`.

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
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
            get(handlers::list_automations).post(handlers::create_automation),
        )
        .route(
            "/{automationId}",
            get(handlers::get_automation)
                .patch(handlers::update_automation)
                .delete(handlers::delete_automation),
        )
        .route("/{automationId}/run", post(handlers::run_automation))
}
