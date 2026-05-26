//! Axum router builder for the transactional templates surface.
//!
//! Routes (mounted relative — caller nests under
//! `/v1/email/templates/transactional`):
//!
//! ```text
//! GET    /                       — list (q, archived, page, limit)
//! POST   /                       — create
//! GET    /{id}                   — read one
//! PATCH  /{id}                   — update fields (key-change tracked)
//! DELETE /{id}                   — hard delete
//! POST   /{id}/preview           — render w/ vars, no send
//! POST   /{id}/test-send         — enqueue test dispatch (TODO: producer)
//! ```

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
use sabnode_auth::AuthConfig;

use crate::handlers;
use crate::state::EmailTemplatesTransactionalState;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    EmailTemplatesTransactionalState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route(
            "/",
            get(handlers::list_templates).post(handlers::create_template),
        )
        .route("/{id}/preview", post(handlers::preview))
        .route("/{id}/test-send", post(handlers::test_send))
        .route(
            "/{id}",
            get(handlers::get_template)
                .patch(handlers::update_template)
                .delete(handlers::delete_template),
        )
}
