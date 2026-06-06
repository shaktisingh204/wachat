//! Axum router mounting all 12 templates-actions endpoints under
//! `/v1/wachat/templates-actions` (caller nests the prefix).

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
use sabnode_auth::AuthConfig;

use crate::{handlers, state::WachatTemplatesActionsState};

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    WachatTemplatesActionsState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        // ----- read -----
        .route("/list", get(handlers::list))
        // ----- write (single) -----
        .route("/sync", post(handlers::sync))
        .route("/create", post(handlers::create))
        .route("/bulk-create", post(handlers::bulk_create))
        .route("/create-flow", post(handlers::create_flow))
        .route("/edit", post(handlers::edit))
        .route("/delete-by-name", post(handlers::delete_by_name))
        .route("/delete-by-id", post(handlers::delete_by_id))
        // ----- multi-language clone (literal segments) -----
        .route("/multilang/clone", post(handlers::multilang_clone))
        // ----- library -----
        .route("/library/list", get(handlers::library_list))
        .route("/library/save", post(handlers::library_save))
        .route("/library/{id}/delete", post(handlers::library_delete))
        .route("/library/{id}/apply", post(handlers::library_apply))
}
