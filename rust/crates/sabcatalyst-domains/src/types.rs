use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SslStatus {
    #[default]
    Pending,
    Issued,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SabcatalystDomain {
    #[serde(rename = "_id")] pub id: ObjectId,
    pub project_id: ObjectId,
    pub user_id: ObjectId,
    pub hostname: String,
    #[serde(default)] pub verified: bool,
    pub ssl_status: SslStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
