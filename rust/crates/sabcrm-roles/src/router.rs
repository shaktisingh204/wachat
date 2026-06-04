//! Axum router for the SabCRM roles & permissions HTTP surface.
//!
//! Exposed as a free function so the orchestrating `api` crate can mount
//! this router into its outer `AppState`:
//!
//! ```ignore
//! .nest("/v1/sabcrm/roles", sabcrm_roles::router::<AppState>())
//! ```
//!
//! `S` only has to expose two slices via `FromRef`:
//!
//! - [`MongoHandle`] — for collection access; and
//! - `Arc<sabnode_auth::AuthConfig>` — the JWT verifier the
//!   [`AuthUser`](sabnode_auth::AuthUser) extractor reads.
//!
//! Routes (mounted relative — caller nests under `/v1/sabcrm/roles`):
//!
//! ```text
//! GET    /              — list_roles
//! POST   /              — create_role
//! GET    /{id}          — get_role
//! PATCH  /{id}          — update_role
//! DELETE /{id}          — delete_role
//! POST   /{id}/members  — set_role_member
//! ```

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post, put},
};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

use crate::handlers;

/// Build the SabCRM roles router. See module docs for the route table and
/// state contract.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/", get(handlers::list_roles).post(handlers::create_role))
        .route("/seed", post(handlers::seed_standard_roles))
        .route("/assign-member", post(handlers::assign_member_role))
        .route(
            "/{id}",
            get(handlers::get_role)
                .patch(handlers::update_role)
                .delete(handlers::delete_role),
        )
        .route(
            "/{id}/members",
            get(handlers::list_role_members).post(handlers::set_role_member),
        )
        .route(
            "/{id}/object-permissions",
            put(handlers::upsert_object_permissions),
        )
        .route(
            "/{id}/field-permissions",
            put(handlers::upsert_field_permissions),
        )
        .route(
            "/{id}/permission-flags",
            put(handlers::upsert_permission_flags),
        )
}
