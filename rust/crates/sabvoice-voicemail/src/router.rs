//! Mountable router. Mount under `/v1/sabvoice/voicemail`.

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
            get(handlers::list_voicemails).post(handlers::create_voicemail),
        )
        .route(
            "/{voicemailId}",
            get(handlers::get_voicemail)
                .patch(handlers::update_voicemail)
                .delete(handlers::delete_voicemail),
        )
        .route("/{voicemailId}/listen", post(handlers::mark_listened))
}
