use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum Platform {
    Twitter,
    Facebook,
    LinkedIn,
    Instagram,
    TikTok,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SocialAccount {
    pub id: Uuid,
    pub platform: Platform,
    pub handle: String,
    pub access_token: String,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum Sentiment {
    Positive,
    Neutral,
    Negative,
    Mixed,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Mention {
    pub id: Uuid,
    pub account_id: Uuid,
    pub post_id: String,
    pub content: String,
    pub author_handle: String,
    pub sentiment: Option<Sentiment>,
    pub created_at: DateTime<Utc>,
    pub is_resolved: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DirectMessage {
    pub id: Uuid,
    pub account_id: Uuid,
    pub sender_id: String,
    pub recipient_id: String,
    pub content: String,
    pub read_status: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CommentThread {
    pub id: Uuid,
    pub post_id: String,
    pub parent_comment_id: Option<String>,
    pub content: String,
    pub author_id: String,
    pub created_at: DateTime<Utc>,
    pub reply_count: u32,
    pub likes_count: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModerationAction {
    pub id: Uuid,
    pub entity_type: String, // e.g. "mention", "comment"
    pub entity_id: Uuid,
    pub action: String, // e.g. "hide", "delete", "escalate"
    pub performed_by: String,
    pub timestamp: DateTime<Utc>,
}
