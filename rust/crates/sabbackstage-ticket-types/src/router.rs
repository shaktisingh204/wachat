//! Mountable router. Mount under `/v1/sabbackstage/ticket-types`.
//!
//! Also exposes a *public* sub-route `/public/by-event/:eventId` that
//! is intentionally unauthenticated — the public ticketed-event page
//! at `/event/[pageSlug]` resolves through it.

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
            get(handlers::list_ticket_types).post(handlers::create_ticket_type),
        )
        .route(
            "/{id}",
            get(handlers::get_ticket_type)
                .patch(handlers::update_ticket_type)
                .delete(handlers::delete_ticket_type),
        )
        .route(
            "/public/by-event/{eventId}",
            get(handlers::public_list_by_event),
        )
}
