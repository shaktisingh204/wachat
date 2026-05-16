//! Mountable router. Mount under `/v1/crm/ticket-groups`.

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
            get(handlers::list_ticket_groups).post(handlers::create_ticket_group),
        )
        .route(
            "/{groupId}",
            get(handlers::get_ticket_group)
                .patch(handlers::update_ticket_group)
                .delete(handlers::delete_ticket_group),
        )
}
