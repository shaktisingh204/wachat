//! Mountable router. Mount under `/v1/sabmeet/qna`.

use std::sync::Arc;

use axum::{Router, extract::FromRef, routing::{get, post}};
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
        .route("/", get(handlers::list_qna).post(handlers::ask_question))
        .route("/{qnaId}/answer", post(handlers::answer_question))
        .route("/{qnaId}/upvote", post(handlers::upvote_question))
}
