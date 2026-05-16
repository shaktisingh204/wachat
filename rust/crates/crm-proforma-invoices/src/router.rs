//! Mountable router. Mount under `/v1/crm/proforma-invoices`.

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
            get(handlers::list_proforma).post(handlers::create_proforma),
        )
        .route(
            "/{proformaId}",
            get(handlers::get_proforma)
                .patch(handlers::update_proforma)
                .delete(handlers::delete_proforma),
        )
}
