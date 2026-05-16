//! Mountable router. Mount under `/v1/crm/announcements`.

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
            get(handlers::list_announcements).post(handlers::create_announcement),
        )
        .route(
            "/{announcementId}",
            get(handlers::get_announcement)
                .patch(handlers::update_announcement)
                .delete(handlers::delete_announcement),
        )
}
