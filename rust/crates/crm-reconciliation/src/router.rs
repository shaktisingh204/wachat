//! Mountable router. Mount under `/v1/crm/reconciliations`.

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
            get(handlers::list_reconciliations).post(handlers::create_reconciliation),
        )
        .route(
            "/{reconciliationId}",
            get(handlers::get_reconciliation)
                .patch(handlers::update_reconciliation)
                .delete(handlers::delete_reconciliation),
        )
}
