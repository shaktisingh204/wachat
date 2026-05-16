//! Mountable router. Mount under `/v1/crm/assets`.

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
        .route("/", get(handlers::list_assets).post(handlers::create_asset))
        .route(
            "/{assetId}",
            get(handlers::get_asset)
                .patch(handlers::update_asset)
                .delete(handlers::delete_asset),
        )
}
