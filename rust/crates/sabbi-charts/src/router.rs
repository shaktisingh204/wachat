//! Mountable router. Mount under `/v1/sabbi/charts`.

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
        .route("/", get(handlers::list_charts).post(handlers::create_chart))
        .route(
            "/{chartId}",
            get(handlers::get_chart)
                .patch(handlers::update_chart)
                .delete(handlers::delete_chart),
        )
        .route("/{chartId}/run", post(handlers::run_chart_handler))
}
