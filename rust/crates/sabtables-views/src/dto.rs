//! Request DTOs for sabtables views.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::types::{SabtablesView, SabtablesViewKind};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub table_id: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub kind: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateViewInput {
    pub table_id: String,
    pub name: String,
    pub kind: SabtablesViewKind,
    #[serde(default)]
    pub config_json: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateViewInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub config_json: Option<HashMap<String, serde_json::Value>>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateViewResponse {
    pub id: String,
    pub entity: SabtablesView,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteViewResponse {
    pub deleted: bool,
}
