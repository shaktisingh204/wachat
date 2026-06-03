use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize, PartialEq, Eq, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum ApiKeyScope {
    Read,
    #[default]
    Write,
    Admin,
}

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize, PartialEq, Eq, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum ApiKeyStatus {
    #[default]
    Active,
    Revoked,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SabcatalystApiKey {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    pub project_id: ObjectId,
    pub user_id: ObjectId,
    pub label: String,
    pub key_hash: String,
    pub scope: ApiKeyScope,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_used_at: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<DateTime<Utc>>,
    pub status: ApiKeyStatus,
    pub created_at: DateTime<Utc>,
}
