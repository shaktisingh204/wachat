//! Mountable router. Mount under `/v1/crm/kpis`.

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
        .route("/", get(handlers::list_kpis).post(handlers::create_kpi))
        .route(
            "/{kpiId}",
            get(handlers::get_kpi)
                .patch(handlers::update_kpi)
                .delete(handlers::delete_kpi),
        )
}
