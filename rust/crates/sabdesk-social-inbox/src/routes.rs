use crate::handlers::*;
use crate::mock_db::AppState;
use axum::{
    routing::{get, post},
    Router,
};

pub fn app_router(state: AppState) -> Router {
    Router::new()
        .route(
            "/api/v1/accounts",
            get(list_social_accounts).post(create_social_account),
        )
        .route(
            "/api/v1/accounts/:id",
            get(get_social_account)
                .put(update_social_account)
                .delete(delete_social_account),
        )
        .route("/api/v1/mentions", get(list_mentions).post(ingest_mention))
        .route("/api/v1/mentions/unresolved", get(get_unresolved_mentions))
        .route("/api/v1/mentions/:id/resolve", post(resolve_mention))
        .route("/api/v1/mentions/sentiment", post(set_sentiment))
        .route(
            "/api/v1/dms",
            get(list_direct_messages).post(send_direct_message),
        )
        .route("/api/v1/dms/:id/read", post(mark_dm_read))
        .route(
            "/api/v1/threads",
            get(list_comment_threads).post(add_comment_thread),
        )
        .route("/api/v1/threads/:id/reply", post(reply_to_comment))
        .route(
            "/api/v1/moderation",
            get(list_moderation_actions).post(perform_moderation),
        )
        .route("/api/v1/moderation/bulk", post(bulk_moderate))
        .route("/api/v1/admin/clear", post(clear_all_data))
        .with_state(state)
}
