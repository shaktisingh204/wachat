//! Mountable router. Mount under `/v1/crm/slas`.

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
        .route("/", get(handlers::list_slas).post(handlers::create_sla))
        .route(
            "/{slaId}",
            get(handlers::get_sla)
                .patch(handlers::update_sla)
                .delete(handlers::delete_sla),
        )
}
