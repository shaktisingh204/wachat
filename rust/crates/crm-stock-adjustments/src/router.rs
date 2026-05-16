//! Mountable router. Mount under `/v1/crm/stock-adjustments`.

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
            get(handlers::list_adjustments).post(handlers::create_adjustment),
        )
        .route(
            "/{adjustmentId}",
            get(handlers::get_adjustment)
                .patch(handlers::update_adjustment)
                .delete(handlers::delete_adjustment),
        )
        .route(
            "/{adjustmentId}/approval",
            post(handlers::approval_decision),
        )
}
