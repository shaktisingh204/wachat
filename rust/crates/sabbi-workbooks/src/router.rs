//! Mountable router. Mount under `/v1/sabbi/workbooks`.

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
            get(handlers::list_workbooks).post(handlers::create_workbook),
        )
        .route(
            "/{workbookId}",
            get(handlers::get_workbook)
                .patch(handlers::update_workbook)
                .delete(handlers::delete_workbook),
        )
}
