//! Mountable router. Nest under `/v1/sabops/ad/groups`.

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
    Router::new().route(
        "/",
        get(handlers::list_ad_groups).post(handlers::upsert_ad_group),
    )
}
