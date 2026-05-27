use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum AuthUserStatus {
    #[default]
    Active,
    Disabled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SabcatalystAuthUser {
    #[serde(rename = "_id")] pub id: ObjectId,
    pub project_id: ObjectId,
    pub user_id: ObjectId, // owner (SabNode user)
    pub email: String,
    pub hashed_password: String,
    #[serde(default)] pub email_verified: bool,
    #[serde(default)] pub status: AuthUserStatus,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub metadata_json: Option<serde_json::Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_sign_in_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
