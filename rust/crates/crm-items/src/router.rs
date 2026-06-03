//! Mountable router for the Item/Product endpoints.
//!
//! Mount under `/v1/crm/items` from the host `api` crate:
//!
//! ```ignore
//! use crm_items;
//! .nest("/v1/crm/items", crm_items::router::<AppState>())
//! ```

use std::sync::Arc;

use axum::{Router, extract::FromRef, routing::get};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

use crate::handlers;

/// Build the router. State must expose `MongoHandle` + `Arc<AuthConfig>`
/// via `FromRef` (the standard `AppState` already does).
///
/// Routes (relative — caller nests under `/v1/crm/items`):
///
/// ```text
/// GET    /             — list_items
/// POST   /             — create_item
/// GET    /{itemId}     — get_item
/// PATCH  /{itemId}     — update_item
/// DELETE /{itemId}     — delete_item (hard delete)
/// ```
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/", get(handlers::list_items).post(handlers::create_item))
        .route(
            "/{itemId}",
            get(handlers::get_item)
                .patch(handlers::update_item)
                .delete(handlers::delete_item),
        )
}
