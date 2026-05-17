//! Mountable router. Mount under `/v1/crm/bank-transactions`.

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
            get(handlers::list_transactions).post(handlers::create_transaction),
        )
        .route(
            "/{transactionId}",
            get(handlers::get_transaction)
                .patch(handlers::update_transaction)
                .delete(handlers::delete_transaction),
        )
}
