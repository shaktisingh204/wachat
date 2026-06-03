//! Axum router for the CRM deals HTTP surface.
//!
//! Exposed as a free function so the orchestrating `api` crate can mount
//! this router into its outer `AppState` without this crate having to
//! know the concrete state struct:
//!
//! ```ignore
//! .nest("/v1/crm/deals", crm_deals::router::<AppState>())
//! ```
//!
//! `S` only has to expose two slices via `FromRef`:
//!
//! - [`MongoHandle`] — for collection access; and
//! - `Arc<sabnode_auth::AuthConfig>` — the JWT verifier the
//!   [`AuthUser`](sabnode_auth::AuthUser) extractor reads.
//!
//! Routes (mounted relative — caller nests under `/v1/crm/deals`):
//!
//! ```text
//! GET    /                     — list_deals
//! POST   /                     — create_deal
//! GET    /{id}                 — get_deal
//! PATCH  /{id}                 — update_deal
//! DELETE /{id}                 — delete_deal
//! ```

use std::sync::Arc;

use axum::{Router, extract::FromRef, routing::get};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

use crate::handlers;

/// Build the CRM deals router. See module docs for the route table and
/// state contract.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/", get(handlers::list_deals).post(handlers::create_deal))
        .route(
            "/{id}",
            get(handlers::get_deal)
                .patch(handlers::update_deal)
                .delete(handlers::delete_deal),
        )
}
