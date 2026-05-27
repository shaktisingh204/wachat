//! Mountable router. Nest under `/v1/sabops/mdm/profiles`.

use std::sync::Arc;

use axum::{Router, extract::FromRef, routing::{get, post}};
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
            get(handlers::list_profiles).post(handlers::create_profile),
        )
        .route(
            "/{profileId}",
            axum::routing::patch(handlers::update_profile).delete(handlers::delete_profile),
        )
        .route("/{profileId}/deploy", post(handlers::deploy_profile))
}
