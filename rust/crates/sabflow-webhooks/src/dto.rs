/// Public response returned after a webhook-triggered execution is enqueued.
#[derive(Debug, serde::Serialize, serde::Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct WebhookTriggerResponse {
    pub execution_id: String,
    pub status: String,
}

/// A registered webhook as returned to callers.
#[derive(Debug, serde::Serialize, serde::Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct WebhookRegistration {
    pub webhook_id: String,
    pub flow_id: String,
    pub app_event: String,
    pub method: String,
    pub auth_type: String,
    pub is_active: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

/// Raw MongoDB document shape for sabflow_webhooks.
#[derive(Debug, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WebhookRegistrationDoc {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<bson::oid::ObjectId>,
    pub webhook_id: String,
    pub flow_id: String,
    pub user_id: String,
    pub app_event: String,
    pub method: String,
    pub authentication: String,
    pub auth_header_name: Option<String>,
    pub auth_header_value: Option<String>,
    pub response_mode: String,
    pub is_active: bool,
    pub created_at: bson::DateTime,
    pub updated_at: bson::DateTime,
}

/// Request body for manually registering a webhook via the API.
#[derive(Debug, serde::Serialize, serde::Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RegisterWebhookRequest {
    pub flow_id: String,
    pub app_event: Option<String>,
    pub method: Option<String>,
    pub authentication: Option<String>,
    pub response_mode: Option<String>,
}
