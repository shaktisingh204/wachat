use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SabcatalystRecord {
    #[serde(rename = "_id")] pub id: ObjectId,
    pub table_id: ObjectId,
    pub project_id: ObjectId,
    pub user_id: ObjectId,
    pub data_json: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
