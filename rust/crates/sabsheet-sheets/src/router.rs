//! Mountable router. Mount under `/v1/sabsheet/sheets`.

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
            get(handlers::list_sheets).post(handlers::create_sheet),
        )
        .route(
            "/{sheetId}",
            get(handlers::get_sheet)
                .patch(handlers::update_sheet)
                .delete(handlers::delete_sheet),
        )
}
