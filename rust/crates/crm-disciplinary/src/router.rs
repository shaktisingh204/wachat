//! Mountable router. Mount under `/v1/crm/disciplinary`.

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
        .route("/", get(handlers::list_cases).post(handlers::create_case))
        .route(
            "/{caseId}",
            get(handlers::get_case)
                .patch(handlers::update_case)
                .delete(handlers::delete_case),
        )
}
