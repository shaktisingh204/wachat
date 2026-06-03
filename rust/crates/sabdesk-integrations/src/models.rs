use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum AppStatus {
    Active,
    Inactive,
    Suspended,
    PendingSetup,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstalledApp {
    pub id: Uuid,
    pub name: String,
    pub provider: String, // e.g., "salesforce", "slack", "jira"
    pub status: AppStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub settings: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum WebhookEvent {
    TicketCreated,
    TicketUpdated,
    UserCreated,
    AppInstalled,
    Custom(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookSubscription {
    pub id: Uuid,
    pub app_id: Uuid,
    pub target_url: String,
    pub events: Vec<WebhookEvent>,
    pub is_active: bool,
    pub secret_key: Option<String>,
    pub created_at: DateTime<Utc>,
    pub last_delivery_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiLog {
    pub id: Uuid,
    pub app_id: Uuid,
    pub request_method: String,
    pub request_path: String,
    pub response_status: u16,
    pub duration_ms: u64,
    pub timestamp: DateTime<Utc>,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSecret {
    pub id: Uuid,
    pub app_id: Uuid,
    pub key_name: String,
    pub key_value_encrypted: String, // Mock encryption
    pub expires_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum SyncStatus {
    Pending,
    Running,
    Completed,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncJob {
    pub id: Uuid,
    pub app_id: Uuid,
    pub entity_type: String, // e.g., "tickets", "users"
    pub status: SyncStatus,
    pub records_processed: u32,
    pub total_records: Option<u32>,
    pub started_at: Option<DateTime<Utc>>,
    pub finished_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub error_details: Option<String>,
}

// Request and Response Models
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateAppRequest {
    pub name: String,
    pub provider: String,
    pub settings: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateAppRequest {
    pub name: Option<String>,
    pub status: Option<AppStatus>,
    pub settings: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateWebhookRequest {
    pub target_url: String,
    pub events: Vec<WebhookEvent>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TriggerSyncRequest {
    pub entity_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BulkDeleteRequest {
    pub ids: Vec<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppAnalytics {
    pub total_apps: usize,
    pub active_apps: usize,
    pub total_webhooks: usize,
    pub total_api_calls_24h: usize,
    pub sync_jobs_running: usize,
}
