//! Mountable routers for the Item/Product endpoints.
//!
//! Two constructors share one handler set; the only difference is the
//! [`ScopeMode`] each attaches as an axum `Extension`:
//!
//! - [`router`] — legacy `userId`-scoped surface. Mount under
//!   `/v1/crm/items`. Behaviour unchanged.
//! - [`project_router`] — SabCRM Supply suite surface, scoped by a
//!   required `projectId`. Mount under `/v1/sabcrm/supply/items`.
//!
//! ```ignore
//! use crm_items;
//! .nest("/v1/crm/items", crm_items::router::<AppState>())
//! .nest("/v1/sabcrm/supply/items", crm_items::project_router::<AppState>())
//! ```
//!
//! Routes (relative):
//!
//! ```text
//! GET    /             — list_items
//! POST   /             — create_item
//! GET    /{itemId}     — get_item
//! PATCH  /{itemId}     — update_item
//! DELETE /{itemId}     — delete_item (hard delete)
//! ```

use std::sync::Arc;

use axum::{Extension, Router, extract::FromRef, routing::get};
use crm_core::ScopeMode;
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

use crate::handlers;

/// The shared CRUD route table (no scope attached yet).
fn crud_routes<S>() -> Router<S>
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

/// Legacy `userId`-scoped router — mount under `/v1/crm/items`.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    crud_routes().layer(Extension(ScopeMode::User))
}

/// SabCRM Supply `projectId`-scoped router — mount under
/// `/v1/sabcrm/supply/items`. Same handlers, same collection; every
/// request must carry `projectId` (query for `GET`/`PATCH`/`DELETE`,
/// body for `POST`) or it is rejected 4xx.
pub fn project_router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    crud_routes().layer(Extension(ScopeMode::Project))
}
