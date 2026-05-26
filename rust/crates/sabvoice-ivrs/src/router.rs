//! Mountable router. Mount under `/v1/sabvoice/ivrs`.

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
        .route("/", get(handlers::list_ivrs).post(handlers::create_ivr))
        .route(
            "/{ivrId}",
            get(handlers::get_ivr)
                .patch(handlers::update_ivr)
                .delete(handlers::delete_ivr),
        )
}
