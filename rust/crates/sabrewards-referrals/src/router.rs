//! Mountable router. Mount under `/v1/sabrewards/referrals`.

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
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
            get(handlers::list_referrals).post(handlers::create_referral),
        )
        .route(
            "/{referralId}",
            get(handlers::get_referral).delete(handlers::delete_referral),
        )
        .route("/{referralId}/conversions", post(handlers::log_conversion))
}
