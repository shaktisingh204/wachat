use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

use crate::types::AuthUserStatus;

pub const MAX_LIMIT: i64 = 100;
fn default_limit() -> i64 { 25 }

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListAuthUsersQuery {
    pub project_id: String,
    #[serde(default)] pub q: Option<String>,
    #[serde(default = "default_limit")] pub limit: i64,
    #[serde(default)] pub cursor: Option<String>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListAuthUsersResponse {
    #[schema(value_type = Vec<Object>)] pub items: Vec<Value>,
    #[serde(skip_serializing_if = "Option::is_none")] pub next_cursor: Option<String>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateAuthUserBody {
    pub project_id: String,
    pub email: String,
    /// Password already hashed (sha256-hex) on the TS side. The Rust
    /// surface never sees plaintext.
    pub hashed_password: String,
    #[serde(default)] pub email_verified: Option<bool>,
    #[serde(default)] pub metadata_json: Option<Value>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateAuthUserBody {
    #[serde(default)] pub email: Option<String>,
    #[serde(default)] pub hashed_password: Option<String>,
    #[serde(default)] pub email_verified: Option<bool>,
    #[serde(default)] pub status: Option<AuthUserStatus>,
    #[serde(default)] pub metadata_json: Option<Value>,
}
