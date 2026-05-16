//! Mountable router. Mount under `/v1/crm/kb-articles`.

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
            get(handlers::list_articles).post(handlers::create_article),
        )
        .route(
            "/{articleId}",
            get(handlers::get_article)
                .patch(handlers::update_article)
                .delete(handlers::delete_article),
        )
}
