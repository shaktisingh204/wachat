//! Mountable router. Mount under `/v1/crm/compensation-bands`.

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
        .route("/", get(handlers::list_bands).post(handlers::create_band))
        .route(
            "/{bandId}",
            get(handlers::get_band)
                .patch(handlers::update_band)
                .delete(handlers::delete_band),
        )
}
