use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiTrainingData {
    pub id: Uuid,
    pub source_type: String, // e.g., "ticket", "kb_article", "chat"
    pub content: String,
    pub labels: Vec<String>,
    pub created_at: DateTime<Utc>,
    pub is_active: bool,
    pub quality_score: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SuggestedReply {
    pub id: Uuid,
    pub conversation_id: Uuid,
    pub agent_id: Option<Uuid>,
    pub suggestion_text: String,
    pub confidence_score: f32,
    pub was_used: bool,
    pub generated_at: DateTime<Utc>,
    pub feedback_score: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversationSummary {
    pub id: Uuid,
    pub conversation_id: Uuid,
    pub summary_text: String,
    pub key_points: Vec<String>,
    pub action_items: Vec<String>,
    pub generated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SentimentScore {
    pub id: Uuid,
    pub target_id: Uuid, // can be a message or conversation
    pub target_type: String, // "message" or "conversation"
    pub score: f32, // -1.0 to 1.0
    pub magnitude: f32, // 0.0 to infinity
    pub emotions: Vec<String>,
    pub analyzed_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeflectionLog {
    pub id: Uuid,
    pub user_query: String,
    pub suggested_articles: Vec<Uuid>,
    pub was_deflected: bool,
    pub deflection_reason: Option<String>,
    pub timestamp: DateTime<Utc>,
}

// Request and Response types

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateAiTrainingDataReq {
    pub source_type: String,
    pub content: String,
    pub labels: Vec<String>,
    pub quality_score: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateAiTrainingDataReq {
    pub source_type: Option<String>,
    pub content: Option<String>,
    pub labels: Option<Vec<String>>,
    pub is_active: Option<bool>,
    pub quality_score: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerateReplyReq {
    pub conversation_id: Uuid,
    pub agent_id: Option<Uuid>,
    pub context_text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubmitReplyFeedbackReq {
    pub feedback_score: i32, // e.g., 1 to 5
    pub was_used: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SummarizeConversationReq {
    pub conversation_id: Uuid,
    pub messages: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalyzeSentimentReq {
    pub target_id: Uuid,
    pub target_type: String,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogDeflectionReq {
    pub user_query: String,
    pub suggested_articles: Vec<Uuid>,
    pub was_deflected: bool,
    pub deflection_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BulkGenerateReplyReq {
    pub requests: Vec<GenerateReplyReq>,
}
