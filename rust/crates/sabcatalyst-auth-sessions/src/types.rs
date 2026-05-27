use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SabcatalystAuthSession {
    #[serde(rename = "_id")] pub id: ObjectId,
    pub auth_user_id: ObjectId,
    pub project_id: ObjectId,
    pub user_id: ObjectId, // SabNode owner
    pub token_hash: String,
    pub expires_at: DateTime<Utc>,
    #[serde(default)] pub revoked: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub ip: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub user_agent: Option<String>,
    pub created_at: DateTime<Utc>,
}
