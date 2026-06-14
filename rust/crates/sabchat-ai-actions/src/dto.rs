//! Wire-format DTOs for the SabChat **action-taking AI** endpoints.
//!
//! Mirrors `sabchat_ai_connectors` / `sabchat_ai_action_runs`. Every body
//! uses `#[serde(rename_all = "camelCase")]` for TS round-tripping.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

/// Connector kinds. v1 ships `http_webhook` (a real outbound call). Other
/// kinds (mcp, native) are reserved for the runtime follow-up.
pub const VALID_CONNECTOR_KINDS: &[&str] = &["http_webhook"];

/// HTTP methods accepted by the `http_webhook` executor.
pub const VALID_HTTP_METHODS: &[&str] = &["GET", "POST", "PUT", "PATCH", "DELETE"];

// ---------------------------------------------------------------------------
// Connector config (for http_webhook)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ConnectorConfig {
    /// Target URL for `http_webhook`.
    #[serde(default)]
    pub url: Option<String>,
    /// HTTP method (default `POST`).
    #[serde(default)]
    pub method: Option<String>,
    /// Static headers sent on every invocation (e.g. an API key).
    #[serde(default)]
    pub headers: Option<std::collections::HashMap<String, String>>,
}

// ---------------------------------------------------------------------------
// POST /connectors
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateConnectorBody {
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    /// One of [`VALID_CONNECTOR_KINDS`]; defaults to `http_webhook`.
    #[serde(default)]
    pub kind: Option<String>,
    #[serde(default)]
    pub config: ConnectorConfig,
    /// Optional JSON-schema describing the input the bot must supply.
    #[serde(default)]
    pub input_schema: Option<Value>,
    #[serde(default = "default_true")]
    pub enabled: bool,
}

fn default_true() -> bool {
    true
}

// ---------------------------------------------------------------------------
// PATCH /connectors/{id}
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateConnectorBody {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub config: Option<ConnectorConfig>,
    #[serde(default)]
    pub input_schema: Option<Value>,
    #[serde(default)]
    pub enabled: Option<bool>,
}

// ---------------------------------------------------------------------------
// POST /connectors/{id}/invoke
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct InvokeBody {
    /// Free-form input forwarded to the connector (request body for HTTP).
    #[serde(default)]
    pub input: Value,
    /// Optional conversation the invocation is tied to (for the audit row).
    #[serde(default)]
    pub conversation_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct InvokeResponse {
    pub run_id: String,
    /// `"ok"` | `"error"`.
    pub status: String,
    /// HTTP status code from the connector, when it responded.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub http_status: Option<u16>,
    #[schema(value_type = Object)]
    pub output: Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct IdResponse {
    pub id: String,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListConnectorsResponse {
    #[schema(value_type = Vec<Object>)]
    pub connectors: Vec<Value>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListRunsResponse {
    #[schema(value_type = Vec<Object>)]
    pub runs: Vec<Value>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SuccessResponse {
    pub message: String,
}
