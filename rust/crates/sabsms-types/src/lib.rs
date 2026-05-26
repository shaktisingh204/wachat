use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum SabsmsMessageStatus {
    Pending,
    Sent,
    Delivered,
    Failed,
    Undelivered,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SabsmsMessage {
    pub id: Uuid,
    pub to: String,
    pub from: String,
    pub body: String,
    pub status: SabsmsMessageStatus,
    pub provider: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SendRequest {
    pub to: String,
    pub from: String,
    pub body: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DlrEvent {
    pub message_id: Uuid,
    pub status: SabsmsMessageStatus,
    pub error_code: Option<String>,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderCreds {
    pub provider_name: String,
    pub api_key: String,
    pub api_secret: Option<String>,
    pub endpoint_url: Option<String>,
}
