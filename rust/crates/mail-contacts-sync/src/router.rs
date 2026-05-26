//! Mountable router for `/v1/mail/contacts-sync`.

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
            get(handlers::list_contacts).post(handlers::create_contact),
        )
        .route(
            "/{contactId}",
            get(handlers::get_contact)
                .patch(handlers::update_contact)
                .delete(handlers::delete_contact),
        )
}
