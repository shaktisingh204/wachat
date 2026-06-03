use axum::{Router, routing::get, extract::FromRef};
use sabnode_db::mongo::MongoHandle;

use crate::handlers::*;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
{
    Router::new()
        .route("/dashboard", get(get_dashboard))
}
