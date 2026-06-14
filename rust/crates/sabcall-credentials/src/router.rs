//! Mountable router. Mount under `/v1/sabcall/credentials`.

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
            get(handlers::list_credentials).post(handlers::create_credential),
        )
        .route(
            "/{credentialId}",
            get(handlers::get_credential)
                .patch(handlers::update_credential)
                .delete(handlers::delete_credential),
        )
}
