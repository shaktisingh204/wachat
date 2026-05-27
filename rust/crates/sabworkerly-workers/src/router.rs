//! Mountable router for SabWorkerly workers.
//!
//! Mount under `/v1/sabworkerly/workers` from the host `api` crate:
//!
//! ```ignore
//! .nest("/v1/sabworkerly/workers", sabworkerly_workers::router::<AppState>())
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
        .route("/", get(handlers::list_workers).post(handlers::create_worker))
        .route(
            "/{workerId}",
            get(handlers::get_worker)
                .patch(handlers::update_worker)
                .delete(handlers::delete_worker),
        )
}
