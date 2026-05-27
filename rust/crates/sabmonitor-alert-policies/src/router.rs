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
        .route("/", get(handlers::list_policies).post(handlers::create_policy))
        .route("/{policyId}", get(handlers::get_policy).patch(handlers::update_policy).delete(handlers::delete_policy))
}
