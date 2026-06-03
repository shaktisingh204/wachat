//! Mountable router. Mount under `/v1/sabwebinar/qna`.
//!
//! `POST /public/ask`, `POST /public/{qnaId}/upvote`, and
//! `GET /public/by-webinar/{webinarId}` are unauthenticated.

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
        .route("/", get(handlers::list_qna))
        .route("/{qnaId}/answer", post(handlers::answer_question))
        .route("/public/ask", post(handlers::ask_question_public))
        .route(
            "/public/{qnaId}/upvote",
            post(handlers::upvote_question_public),
        )
        .route(
            "/public/by-webinar/{webinarId}",
            get(handlers::list_qna_public),
        )
}
