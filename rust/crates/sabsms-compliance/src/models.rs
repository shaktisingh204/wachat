use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageContext {
    pub from: String,
    pub to: String,
    pub content: String,
    pub country_code: String,
    pub timestamp: DateTime<Utc>,
    pub metadata: MessageMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MessageMetadata {
    pub is_promotional: bool,
    pub dlt_template_id: Option<String>,
    pub dlt_entity_id: Option<String>,
    pub campaign_id: Option<String>,
    pub use_case: Option<String>, // e.g., "MARKETING", "TRANSACTIONAL"
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum OptStatus {
    OptedIn,
    OptedOut,
}
