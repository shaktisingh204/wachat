//! Mountable router. Mount under `/v1/crm/vendor-types`.

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
            get(handlers::list_vendor_types).post(handlers::create_vendor_type),
        )
        .route(
            "/{vendorTypeId}",
            get(handlers::get_vendor_type)
                .patch(handlers::update_vendor_type)
                .delete(handlers::delete_vendor_type),
        )
}
