use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum InvocationStatus {
    #[default]
    Success,
    Error,
    Timeout,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SabcatalystFunctionInvocation {
    #[serde(rename = "_id")] pub id: ObjectId,
    pub function_id: ObjectId,
    pub project_id: ObjectId,
    pub user_id: ObjectId,
    pub ts: DateTime<Utc>,
    pub duration_ms: u32,
    pub status: InvocationStatus,
    pub request_size_bytes: u32,
    pub response_size_bytes: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error_message: Option<String>,
    pub billable_ms: u32,
}
