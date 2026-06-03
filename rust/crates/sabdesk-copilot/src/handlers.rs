use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::{Utc, Duration};
use serde_json::json;
use uuid::Uuid;
use std::collections::HashMap;

use crate::models::*;
use crate::mock_db::AppState;

// 1. Create Training Data
pub async fn create_training_data(
    State(state): State<AppState>,
    Json(payload): Json<CreateAiTrainingDataReq>,
) -> impl IntoResponse {
    let id = Uuid::new_v4();
    let data = AiTrainingData {
        id,
        source_type: payload.source_type,
        content: payload.content,
        labels: payload.labels,
        created_at: Utc::now(),
        is_active: true,
        quality_score: payload.quality_score,
    };

    let mut db = state.write().await;
    db.training_data.insert(id, data.clone());

    (StatusCode::CREATED, Json(data))
}

// 2. Get Training Data
pub async fn get_training_data(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let db = state.read().await;
    if let Some(data) = db.training_data.get(&id) {
        (StatusCode::OK, Json(json!(data))).into_response()
    } else {
        (StatusCode::NOT_FOUND, Json(json!({"error": "not found"}))).into_response()
    }
}

// 3. List Training Data
pub async fn list_training_data(
    State(state): State<AppState>,
) -> impl IntoResponse {
    let db = state.read().await;
    let list: Vec<AiTrainingData> = db.training_data.values().cloned().collect();
    (StatusCode::OK, Json(list))
}

// 4. Update Training Data
pub async fn update_training_data(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateAiTrainingDataReq>,
) -> impl IntoResponse {
    let mut db = state.write().await;
    if let Some(data) = db.training_data.get_mut(&id) {
        if let Some(st) = payload.source_type {
            data.source_type = st;
        }
        if let Some(c) = payload.content {
            data.content = c;
        }
        if let Some(l) = payload.labels {
            data.labels = l;
        }
        if let Some(ia) = payload.is_active {
            data.is_active = ia;
        }
        if let Some(qs) = payload.quality_score {
            data.quality_score = qs;
        }
        (StatusCode::OK, Json(json!(data.clone()))).into_response()
    } else {
        (StatusCode::NOT_FOUND, Json(json!({"error": "not found"}))).into_response()
    }
}

// 5. Delete Training Data
pub async fn delete_training_data(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let mut db = state.write().await;
    if db.training_data.remove(&id).is_some() {
        (StatusCode::NO_CONTENT, Json(json!({}))).into_response()
    } else {
        (StatusCode::NOT_FOUND, Json(json!({"error": "not found"}))).into_response()
    }
}

// 6. Generate Reply (Mock AI)
pub async fn generate_reply(
    State(state): State<AppState>,
    Json(payload): Json<GenerateReplyReq>,
) -> impl IntoResponse {
    let id = Uuid::new_v4();
    
    // Mock processing based on context_text length
    let mock_suggestion = format!("Based on your request: '{}...', here is a suggestion.", &payload.context_text.chars().take(10).collect::<String>());
    
    let reply = SuggestedReply {
        id,
        conversation_id: payload.conversation_id,
        agent_id: payload.agent_id,
        suggestion_text: mock_suggestion,
        confidence_score: 0.85,
        was_used: false,
        generated_at: Utc::now(),
        feedback_score: None,
    };

    let mut db = state.write().await;
    db.suggested_replies.insert(id, reply.clone());

    (StatusCode::CREATED, Json(reply))
}

// 7. Get Suggested Reply
pub async fn get_suggested_reply(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let db = state.read().await;
    if let Some(reply) = db.suggested_replies.get(&id) {
        (StatusCode::OK, Json(json!(reply))).into_response()
    } else {
        (StatusCode::NOT_FOUND, Json(json!({"error": "not found"}))).into_response()
    }
}

// 8. List Suggested Replies for a Conversation
pub async fn list_suggested_replies(
    State(state): State<AppState>,
    Path(conversation_id): Path<Uuid>,
) -> impl IntoResponse {
    let db = state.read().await;
    let list: Vec<SuggestedReply> = db.suggested_replies.values()
        .filter(|r| r.conversation_id == conversation_id)
        .cloned()
        .collect();
    (StatusCode::OK, Json(list))
}

// 9. Submit Reply Feedback
pub async fn submit_reply_feedback(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<SubmitReplyFeedbackReq>,
) -> impl IntoResponse {
    let mut db = state.write().await;
    if let Some(reply) = db.suggested_replies.get_mut(&id) {
        reply.feedback_score = Some(payload.feedback_score);
        reply.was_used = payload.was_used;
        (StatusCode::OK, Json(json!(reply.clone()))).into_response()
    } else {
        (StatusCode::NOT_FOUND, Json(json!({"error": "not found"}))).into_response()
    }
}

// 10. Summarize Conversation (Mock AI)
pub async fn summarize_conversation(
    State(state): State<AppState>,
    Json(payload): Json<SummarizeConversationReq>,
) -> impl IntoResponse {
    let id = Uuid::new_v4();
    let msg_count = payload.messages.len();
    
    let summary = ConversationSummary {
        id,
        conversation_id: payload.conversation_id,
        summary_text: format!("Conversation had {} messages. The main topic seems to be support.", msg_count),
        key_points: vec!["Customer asked a question".to_string(), "Agent replied".to_string()],
        action_items: vec!["Follow up in 2 days".to_string()],
        generated_at: Utc::now(),
    };

    let mut db = state.write().await;
    db.summaries.insert(id, summary.clone());

    (StatusCode::CREATED, Json(summary))
}

// 11. Get Conversation Summary
pub async fn get_conversation_summary(
    State(state): State<AppState>,
    Path(conversation_id): Path<Uuid>,
) -> impl IntoResponse {
    let db = state.read().await;
    if let Some(summary) = db.summaries.values().find(|s| s.conversation_id == conversation_id) {
        (StatusCode::OK, Json(json!(summary))).into_response()
    } else {
        (StatusCode::NOT_FOUND, Json(json!({"error": "not found"}))).into_response()
    }
}

// 12. Analyze Sentiment (Mock AI)
pub async fn analyze_sentiment(
    State(state): State<AppState>,
    Json(payload): Json<AnalyzeSentimentReq>,
) -> impl IntoResponse {
    let id = Uuid::new_v4();
    
    // Mock sentiment based on text
    let (score, emotions) = if payload.text.to_lowercase().contains("angry") || payload.text.to_lowercase().contains("bad") {
        (-0.8, vec!["anger".to_string(), "frustration".to_string()])
    } else if payload.text.to_lowercase().contains("happy") || payload.text.to_lowercase().contains("good") {
        (0.9, vec!["joy".to_string(), "satisfaction".to_string()])
    } else {
        (0.1, vec!["neutral".to_string()])
    };

    let sentiment = SentimentScore {
        id,
        target_id: payload.target_id,
        target_type: payload.target_type,
        score,
        magnitude: 1.5,
        emotions,
        analyzed_at: Utc::now(),
    };

    let mut db = state.write().await;
    db.sentiments.insert(id, sentiment.clone());

    (StatusCode::CREATED, Json(sentiment))
}

// 13. Get Sentiment
pub async fn get_sentiment(
    State(state): State<AppState>,
    Path(target_id): Path<Uuid>,
) -> impl IntoResponse {
    let db = state.read().await;
    if let Some(sentiment) = db.sentiments.values().find(|s| s.target_id == target_id) {
        (StatusCode::OK, Json(json!(sentiment))).into_response()
    } else {
        (StatusCode::NOT_FOUND, Json(json!({"error": "not found"}))).into_response()
    }
}

// 14. Log Deflection
pub async fn log_deflection(
    State(state): State<AppState>,
    Json(payload): Json<LogDeflectionReq>,
) -> impl IntoResponse {
    let id = Uuid::new_v4();
    let deflection = DeflectionLog {
        id,
        user_query: payload.user_query,
        suggested_articles: payload.suggested_articles,
        was_deflected: payload.was_deflected,
        deflection_reason: payload.deflection_reason,
        timestamp: Utc::now(),
    };

    let mut db = state.write().await;
    db.deflections.insert(id, deflection.clone());

    (StatusCode::CREATED, Json(deflection))
}

// 15. List Deflections
pub async fn list_deflections(
    State(state): State<AppState>,
) -> impl IntoResponse {
    let db = state.read().await;
    let list: Vec<DeflectionLog> = db.deflections.values().cloned().collect();
    (StatusCode::OK, Json(list))
}

// 16. Get Deflection Analytics
pub async fn get_deflection_analytics(
    State(state): State<AppState>,
) -> impl IntoResponse {
    let db = state.read().await;
    let total = db.deflections.len();
    let deflected = db.deflections.values().filter(|d| d.was_deflected).count();
    let rate = if total > 0 { (deflected as f64) / (total as f64) } else { 0.0 };

    (StatusCode::OK, Json(json!({
        "total_queries": total,
        "successful_deflections": deflected,
        "deflection_rate": rate,
    })))
}

// 17. Bulk Generate Replies
pub async fn bulk_generate_replies(
    State(state): State<AppState>,
    Json(payload): Json<BulkGenerateReplyReq>,
) -> impl IntoResponse {
    let mut db = state.write().await;
    let mut results = Vec::new();

    for req in payload.requests {
        let id = Uuid::new_v4();
        let mock_suggestion = format!("Bulk generated suggestion for '{}...'", &req.context_text.chars().take(10).collect::<String>());
        let reply = SuggestedReply {
            id,
            conversation_id: req.conversation_id,
            agent_id: req.agent_id,
            suggestion_text: mock_suggestion,
            confidence_score: 0.75,
            was_used: false,
            generated_at: Utc::now(),
            feedback_score: None,
        };
        db.suggested_replies.insert(id, reply.clone());
        results.push(reply);
    }

    (StatusCode::CREATED, Json(results))
}

// 18. Bulk Delete Training Data
#[derive(serde::Deserialize)]
pub struct BulkDeleteReq {
    pub ids: Vec<Uuid>,
}

pub async fn bulk_delete_training_data(
    State(state): State<AppState>,
    Json(payload): Json<BulkDeleteReq>,
) -> impl IntoResponse {
    let mut db = state.write().await;
    let mut deleted_count = 0;
    
    for id in payload.ids {
        if db.training_data.remove(&id).is_some() {
            deleted_count += 1;
        }
    }

    (StatusCode::OK, Json(json!({ "deleted_count": deleted_count })))
}

// 19. Get Training Data Stats
pub async fn get_training_data_stats(
    State(state): State<AppState>,
) -> impl IntoResponse {
    let db = state.read().await;
    let total = db.training_data.len();
    let active = db.training_data.values().filter(|t| t.is_active).count();
    
    let mut type_counts: HashMap<String, usize> = HashMap::new();
    for t in db.training_data.values() {
        *type_counts.entry(t.source_type.clone()).or_insert(0) += 1;
    }

    (StatusCode::OK, Json(json!({
        "total_items": total,
        "active_items": active,
        "items_by_source_type": type_counts,
    })))
}

// 20. Purge Old Suggestions
pub async fn purge_old_suggestions(
    State(state): State<AppState>,
) -> impl IntoResponse {
    let mut db = state.write().await;
    let threshold = Utc::now() - Duration::days(30);
    
    let to_remove: Vec<Uuid> = db.suggested_replies.values()
        .filter(|r| r.generated_at < threshold && !r.was_used)
        .map(|r| r.id)
        .collect();
        
    let count = to_remove.len();
    for id in to_remove {
        db.suggested_replies.remove(&id);
    }
    
    (StatusCode::OK, Json(json!({ "purged_count": count })))
}
