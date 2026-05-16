//! Mountable router. Mount under `/v1/crm/voucher-books`.

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
        .route("/", get(handlers::list_books).post(handlers::create_book))
        .route(
            "/{bookId}",
            get(handlers::get_book)
                .patch(handlers::update_book)
                .delete(handlers::delete_book),
        )
}
