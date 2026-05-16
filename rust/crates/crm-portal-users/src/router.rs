//! Mountable router. Mount under `/v1/crm/portal-users`.

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
            get(handlers::list_portal_users).post(handlers::create_portal_user),
        )
        .route(
            "/{portalUserId}",
            get(handlers::get_portal_user)
                .patch(handlers::update_portal_user)
                .delete(handlers::delete_portal_user),
        )
}
