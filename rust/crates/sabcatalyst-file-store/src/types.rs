use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SabcatalystFileStoreEntry {
    #[serde(rename = "_id")] pub id: ObjectId,
    pub project_id: ObjectId,
    pub user_id: ObjectId,
    pub key: String,
    pub sabfiles_file_id: String,
    pub size_bytes: i64,
    pub content_type: String,
    #[serde(default)] pub public: bool,
    pub uploaded_at: DateTime<Utc>,
}
