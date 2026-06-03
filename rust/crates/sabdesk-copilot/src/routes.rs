use axum::{
    routing::{get, post},
    Router,
};
use crate::mock_db::AppState;
use crate::handlers::*;

pub fn create_router(state: AppState) -> Router {
    Router::new()
        .route("/api/v1/training_data", post(create_training_data).get(list_training_data))
        .route("/api/v1/training_data/:id", get(get_training_data).put(update_training_data).delete(delete_training_data))
        .route("/api/v1/training_data/bulk_delete", post(bulk_delete_training_data))
        .route("/api/v1/training_data/stats", get(get_training_data_stats))
        
        .route("/api/v1/replies/generate", post(generate_reply))
        .route("/api/v1/replies/bulk_generate", post(bulk_generate_replies))
        .route("/api/v1/replies/suggested/:id", get(get_suggested_reply))
        .route("/api/v1/replies/suggested/:id/feedback", post(submit_reply_feedback))
        .route("/api/v1/replies/conversation/:conversation_id", get(list_suggested_replies))
        .route("/api/v1/replies/purge", post(purge_old_suggestions))
        
        .route("/api/v1/conversations/summarize", post(summarize_conversation))
        .route("/api/v1/conversations/:conversation_id/summary", get(get_conversation_summary))
        
        .route("/api/v1/sentiment/analyze", post(analyze_sentiment))
        .route("/api/v1/sentiment/target/:target_id", get(get_sentiment))
        
        .route("/api/v1/deflections", post(log_deflection).get(list_deflections))
        .route("/api/v1/deflections/analytics", get(get_deflection_analytics))
        .with_state(state)
}
