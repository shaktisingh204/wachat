//! Request DTOs for sabtables records.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::types::SabtablesRecord;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub q: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    pub table_id: String,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateRecordInput {
    pub table_id: String,
    #[serde(default)]
    pub fields_json: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateRecordInput {
    #[serde(default)]
    pub fields_json: Option<HashMap<String, serde_json::Value>>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateRecordResponse {
    pub id: String,
    pub entity: SabtablesRecord,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteRecordResponse {
    pub deleted: bool,
}

/// Payload for the formula-preview endpoint.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvaluateFormulaInput {
    pub expression: String,
    /// Map of `Field Name` -> value-as-json (number / string / bool).
    /// The evaluator looks up `{Field Name}` refs against this map.
    #[serde(default)]
    pub fields: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EvaluateFormulaResponse {
    pub value: serde_json::Value,
}
