//! Mountable router for the Request Blueprint endpoints.
//!
//! Mount under `/v1/sabrequests/blueprints` from the host `api` crate:
//!
//! ```ignore
//! use sabrequests_blueprints;
//! .nest("/v1/sabrequests/blueprints", sabrequests_blueprints::router::<AppState>())
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
        .route(
            "/",
            get(handlers::list_blueprints).post(handlers::create_blueprint),
        )
        .route(
            "/{blueprintId}",
            get(handlers::get_blueprint)
                .patch(handlers::update_blueprint)
                .delete(handlers::delete_blueprint),
        )
}
