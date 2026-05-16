//! Mountable router. Mount under `/v1/crm/loans`.

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
        .route("/", get(handlers::list_loans).post(handlers::create_loan))
        .route(
            "/{loanId}",
            get(handlers::get_loan)
                .patch(handlers::update_loan)
                .delete(handlers::delete_loan),
        )
}
