//! Request DTOs.

use serde::{Deserialize, Serialize};

use crate::types::CrmPtSlab;

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
    #[serde(default)]
    pub state: Option<String>,
    #[serde(default)]
    pub gender: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePtSlabInput {
    pub state: String,
    #[serde(default)]
    pub gender: Option<String>,
    pub min_amount: f64,
    #[serde(default)]
    pub max_amount: Option<f64>,
    pub tax_amount: f64,
    #[serde(default)]
    pub effective_from: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePtSlabInput {
    #[serde(default)]
    pub state: Option<String>,
    #[serde(default)]
    pub gender: Option<String>,
    #[serde(default)]
    pub min_amount: Option<f64>,
    #[serde(default)]
    pub max_amount: Option<f64>,
    #[serde(default)]
    pub tax_amount: Option<f64>,
    #[serde(default)]
    pub effective_from: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePtSlabResponse {
    pub id: String,
    pub entity: CrmPtSlab,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeletePtSlabResponse {
    pub deleted: bool,
}
