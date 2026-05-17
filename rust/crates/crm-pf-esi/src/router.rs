//! Mountable router. Mount under `/v1/crm/pf-esi`.

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
            get(handlers::list_pf_esi).post(handlers::create_pf_esi),
        )
        .route(
            "/{recordId}",
            get(handlers::get_pf_esi)
                .patch(handlers::update_pf_esi)
                .delete(handlers::delete_pf_esi),
        )
}
