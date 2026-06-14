//! Mountable router. Mount under `/v1/sabcall/acls`.

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
        .route("/", get(handlers::list_acls).post(handlers::create_acl))
        .route(
            "/{aclId}",
            get(handlers::get_acl)
                .patch(handlers::update_acl)
                .delete(handlers::delete_acl),
        )
}
