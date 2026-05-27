use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum UsagePeriod {
    Daily,
    #[default]
    Monthly,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SabcatalystUsage {
    #[serde(rename = "_id")] pub id: ObjectId,
    pub project_id: ObjectId,
    pub user_id: ObjectId,
    pub period: UsagePeriod,
    /// `YYYY-MM` for monthly, `YYYY-MM-DD` for daily.
    pub period_key: String,
    #[serde(default)] pub function_invocations: i64,
    #[serde(default)] pub function_billable_ms: i64,
    #[serde(default)] pub datastore_reads: i64,
    #[serde(default)] pub datastore_writes: i64,
    #[serde(default)] pub file_storage_bytes: i64,
    #[serde(default)] pub bandwidth_bytes: i64,
    pub updated_at: DateTime<Utc>,
}
