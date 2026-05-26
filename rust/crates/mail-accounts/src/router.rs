//! Mountable router for `/v1/mail/accounts`.

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
            get(handlers::list_accounts).post(handlers::create_account),
        )
        .route(
            "/{accountId}",
            get(handlers::get_account)
                .patch(handlers::update_account)
                .delete(handlers::delete_account),
        )
}
