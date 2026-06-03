use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

use crate::types::ApiKeyScope;

pub const MAX_LIMIT: i64 = 100;
fn default_limit() -> i64 {
    25
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListKeysQuery {
    pub project_id: String,
    #[serde(default = "default_limit")]
    pub limit: i64,
    #[serde(default)]
    pub cursor: Option<String>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListKeysResponse {
    #[schema(value_type = Vec<Object>)]
    pub items: Vec<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next_cursor: Option<String>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateKeyBody {
    pub project_id: String,
    pub label: String,
    /// SHA-256 hex hash of the plaintext secret — generated TS-side so
    /// the plaintext only ever lives in the response of the calling
    /// server action, never on the wire to Rust.
    pub key_hash: String,
    #[serde(default)]
    pub scope: Option<ApiKeyScope>,
    #[serde(default)]
    pub expires_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct LookupKeyBody {
    pub project_id: String,
    pub key_hash: String,
}
