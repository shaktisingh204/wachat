use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::events::EmailEventKind;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailApiKey {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    pub user_id: ObjectId,
    pub name: String,
    pub key_hash: String,
    pub prefix: String,
    #[serde(default)]
    pub scopes: Vec<String>,
    #[serde(default)]
    pub last_used_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    #[serde(default)]
    pub revoked_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailWebhookConfig {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    pub user_id: ObjectId,
    pub url: String,
    pub secret: String,
    pub events: Vec<EmailEventKind>,
    pub active: bool,
    #[serde(default)]
    pub failure_count: u64,
    #[serde(default)]
    pub last_delivered_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub last_failed_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
