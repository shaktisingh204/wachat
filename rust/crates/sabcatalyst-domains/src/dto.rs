use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

use crate::types::SslStatus;

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListDomainsQuery {
    pub project_id: String,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListDomainsResponse {
    #[schema(value_type = Vec<Object>)] pub items: Vec<Value>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateDomainBody {
    pub project_id: String,
    pub hostname: String,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateDomainBody {
    #[serde(default)] pub verified: Option<bool>,
    #[serde(default)] pub ssl_status: Option<SslStatus>,
}
