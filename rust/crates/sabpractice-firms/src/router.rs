//! Mountable router for the SabPractice Firm endpoints.
//!
//! Mount under `/v1/sabpractice/firms` from the host `api` crate:
//!
//! ```ignore
//! .nest("/v1/sabpractice/firms", sabpractice_firms::router::<AppState>())
//! ```

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
        .route("/", get(handlers::list_firms).post(handlers::create_firm))
        .route(
            "/{firmId}",
            get(handlers::get_firm)
                .patch(handlers::update_firm)
                .delete(handlers::delete_firm),
        )
}
