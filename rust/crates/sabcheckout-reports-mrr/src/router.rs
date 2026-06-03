//! Mountable router. Mount under `/v1/sabcheckout/mrr_reports`.

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
            get(handlers::list_mrr_reports).post(handlers::create_mrr_report),
        )
        .route(
            "/{reportId}",
            get(handlers::get_mrr_report)
                .patch(handlers::update_mrr_report)
                .delete(handlers::delete_mrr_report),
        )
}
