//! Mountable router. Nest under `/v1/sabops/patch-policies`.

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
            get(handlers::list_policies).post(handlers::create_policy),
        )
        .route(
            "/{policyId}",
            axum::routing::patch(handlers::update_policy).delete(handlers::delete_policy),
        )
        .route("/{policyId}/apply", post(handlers::apply_policy))
}
