//! Persisted entity types for SabCatalyst functions.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum FunctionKind {
    #[default]
    Http,
    Cron,
    Event,
    Queue,
}

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum FunctionRuntime {
    #[default]
    Nodejs20,
    Python311,
    Deno,
    Bun,
}

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum FunctionStatus {
    #[default]
    Active,
    Paused,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SabcatalystFunction {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    pub project_id: ObjectId,
    pub user_id: ObjectId,
    pub name: String,
    pub kind: FunctionKind,
    pub runtime: FunctionRuntime,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub code_blob_file_id: Option<String>,
    pub entrypoint: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub env_vars_json: Option<serde_json::Value>,
    pub timeout_ms: u32,
    pub memory_mb: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub schedule: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_deployed_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub status: FunctionStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
