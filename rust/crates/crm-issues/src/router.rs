//! Mountable router. Mount under `/v1/crm/issues`.

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
        .route("/", get(handlers::list_issues).post(handlers::create_issue))
        .route(
            "/{issueId}",
            get(handlers::get_issue)
                .patch(handlers::update_issue)
                .delete(handlers::delete_issue),
        )
}
