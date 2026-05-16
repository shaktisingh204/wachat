//! Mountable router. Mount under `/v1/crm/payroll-settings`.

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
            get(handlers::list_settings).post(handlers::create_setting),
        )
        .route(
            "/{settingId}",
            get(handlers::get_setting)
                .patch(handlers::update_setting)
                .delete(handlers::delete_setting),
        )
}
