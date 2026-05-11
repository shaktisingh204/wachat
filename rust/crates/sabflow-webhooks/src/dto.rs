#[derive(Debug, serde::Serialize, serde::Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct WebhookTriggerResponse {
    pub execution_id: String,
    pub status: String,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct WebhookRegistration {
    pub id: String,
    pub flow_id: String,
    pub event_id: String,
    pub method: String,
    pub auth_type: String,
    pub is_active: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
}
